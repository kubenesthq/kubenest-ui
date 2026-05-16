'use client';

/**
 * Drawer for adding a new component (workload or addon) to a running app —
 * the kn-a4l counterpart to the app-create flow's component builder.
 *
 * The shape we emit matches `AppComponent` / backend `TemplateComponent`
 * (kn-coa), so the backend PATCH validation can reject duplicate names or
 * other shape problems without a second client-side rule. We do still
 * validate the component name client-side against the DNS-label regex used
 * everywhere else in this app, so users get instant feedback before the
 * round-trip.
 *
 * State machine: closed → type_select → workload_form | addon_form → submitting.
 * The drawer never closes automatically on submit — only on explicit success
 * (so an inline 4xx error keeps the user's edits and lets them retry).
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Cog,
  Database,
  Globe,
  Loader2,
  Plus,
  Server,
  X,
} from 'lucide-react';
import { addonDefinitionsApi } from '@/lib/api/addons';
import { ApiClientError } from '@/lib/api-client';
import { Btn } from '@/components/shell/primitives';
import { EnvVarRow } from './EnvVarRow';
import { FieldLabel, TInput, TSelect } from './form-controls';
import type {
  AddonDefinition,
  AddonType,
  AppComponent,
  AppEnvVar,
  AppReadComponent,
} from '@/types/api';

// Same DNS-label rule used in the create flow + by the backend TemplateComponent.
const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

type DrawerStep = 'type' | 'workload' | 'addon';
type WorkloadKind = 'web-service' | 'worker';

interface WorkloadFormState {
  name: string;
  image: string;
  replicas: number;
  port: string; // text so an empty box doesn't coerce to 0
  kind: WorkloadKind;
  ingressEnabled: boolean;
  ingressHost: string;
  env: AppEnvVar[];
}

interface AddonFormState {
  name: string;
  definitionId: string;
  valuesJson: string;
}

function defaultWorkload(): WorkloadFormState {
  return {
    name: '',
    image: '',
    replicas: 1,
    port: '8080',
    kind: 'web-service',
    ingressEnabled: false,
    ingressHost: '',
    env: [],
  };
}

function defaultAddon(): AddonFormState {
  return { name: '', definitionId: '', valuesJson: '{}' };
}

/** Try to extract a useful error message from a thrown patch-mutation error. */
function patchErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 409) return 'A component with this name already exists in this app.';
    const detail = error.detail as Record<string, unknown> | null;
    const detailMessage = detail && typeof detail.message === 'string' ? detail.message : undefined;
    return detailMessage ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to add component';
}

export function AddComponentDrawer({
  open,
  onClose,
  onAdd,
  isPending,
  existingComponents,
  existingNames,
}: {
  open: boolean;
  onClose: () => void;
  /** Resolves on success — the drawer closes only after the resolve. */
  onAdd: (component: AppComponent) => Promise<void>;
  isPending: boolean;
  /** Existing app components — read for the export_ref picker. */
  existingComponents: AppReadComponent[];
  /** Names already in use — block client-side, backend also validates. */
  existingNames: string[];
}) {
  const [step, setStep] = useState<DrawerStep>('type');
  const [workload, setWorkload] = useState<WorkloadFormState>(defaultWorkload);
  const [addon, setAddon] = useState<AddonFormState>(defaultAddon);
  const [error, setError] = useState<string | null>(null);

  // Addon definitions feed both the addon form and the workload export_ref
  // picker (so a workload added to an app that already has a postgres can
  // immediately link DATABASE_URL).
  const { data: addonDefsData, isLoading: addonDefsLoading } = useQuery({
    queryKey: ['addon-definitions'],
    queryFn: () => addonDefinitionsApi.list({ items_per_page: 100 }),
    enabled: open,
  });
  // Stabilise the derived array so `addonRefs` and downstream child memos
  // don't re-fire on every render of the parent.
  const addonDefinitions = useMemo(() => addonDefsData?.data ?? [], [addonDefsData]);

  // Synthesise `EnvVarRowAddonRef`s from this app's existing addon components
  // so the picker shows "this app's postgres → DATABASE_URL" — matching the
  // mental model the user already saw on the create page.
  const addonRefs = useMemo(
    () =>
      existingComponents
        .filter((c) => c.type === 'addon')
        .map((c) => {
          const def = matchDefinitionForComponent(c, addonDefinitions);
          return { id: c.name, name: c.name, addon: def ? { definitionId: def.id } : undefined };
        }),
    [existingComponents, addonDefinitions],
  );

  if (!open) return null;

  const close = () => {
    setStep('type');
    setWorkload(defaultWorkload());
    setAddon(defaultAddon());
    setError(null);
    onClose();
  };

  const handleBack = () => {
    setError(null);
    setStep('type');
  };

  const submitWorkload = async () => {
    setError(null);
    if (!workload.name.trim()) return setError('Component name is required.');
    if (!k8sNameRegex.test(workload.name)) return setError('Name must be lowercase letters, numbers, and hyphens (DNS label).');
    if (existingNames.includes(workload.name)) return setError(`A component named "${workload.name}" already exists in this app.`);
    if (!workload.image.trim()) return setError('Container image is required.');
    if (workload.replicas < 0 || workload.replicas > 100) return setError('Replicas must be between 0 and 100.');

    let parsedPort: number | undefined;
    if (workload.kind === 'web-service') {
      if (workload.port.trim()) {
        const num = Number(workload.port);
        if (!Number.isInteger(num) || num < 1 || num > 65535) return setError('Port must be 1-65535.');
        parsedPort = num;
      }
      if (workload.ingressEnabled && !workload.ingressHost.trim()) {
        return setError('Ingress host is required when ingress is enabled.');
      }
    }

    const envClean: AppEnvVar[] = workload.env
      .filter((e) => e.name.trim())
      .map((e) => (e.export_ref ? { name: e.name, export_ref: e.export_ref } : { name: e.name, value: e.value ?? '' }));

    const dependsOn = Array.from(
      new Set(envClean.map((e) => e.export_ref?.component).filter((c): c is string => Boolean(c))),
    );

    const component: AppComponent = {
      name: workload.name,
      type: 'workload',
      depends_on: dependsOn.length > 0 ? dependsOn : undefined,
      workload_spec: {
        image: workload.image,
        replicas: workload.replicas,
        port: workload.kind === 'web-service' ? parsedPort : undefined,
        env: envClean.length > 0 ? envClean : undefined,
        ingress:
          workload.kind === 'web-service' && workload.ingressEnabled && workload.ingressHost
            ? { enabled: true, host: workload.ingressHost.trim(), path: '/' }
            : undefined,
      },
    };

    try {
      await onAdd(component);
      close();
    } catch (err) {
      setError(patchErrorMessage(err));
    }
  };

  const submitAddon = async () => {
    setError(null);
    if (!addon.name.trim()) return setError('Component name is required.');
    if (!k8sNameRegex.test(addon.name)) return setError('Name must be lowercase letters, numbers, and hyphens (DNS label).');
    if (existingNames.includes(addon.name)) return setError(`A component named "${addon.name}" already exists in this app.`);
    if (!addon.definitionId) return setError('Pick an addon from the catalog.');

    const def = addonDefinitions.find((d) => d.id === addon.definitionId);
    if (!def) return setError('Selected addon definition is no longer available.');
    if (!def.chart_config) return setError(`Addon "${def.name}" has no chart config — pick another.`);

    let values: Record<string, unknown> | undefined;
    const trimmed = addon.valuesJson.trim();
    if (trimmed && trimmed !== '{}') {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return setError('Values must be a JSON object.');
        }
        values = parsed as Record<string, unknown>;
      } catch {
        return setError('Values is not valid JSON.');
      }
    }

    const component: AppComponent = {
      name: addon.name,
      type: 'addon',
      addon_spec: {
        type: def.type as AddonType,
        chart: def.chart_config,
        values,
      },
    };

    try {
      await onAdd(component);
      close();
    } catch (err) {
      setError(patchErrorMessage(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add component"
        className="w-full sm:w-[520px] sm:h-full bg-[var(--surface)] flex flex-col anim-slide-up sm:anim-slide-in"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)' }}
      >
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {step !== 'type' && (
            <button type="button" onClick={handleBack} className="hover:opacity-70" style={{ color: 'var(--text-3)' }} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
              {step === 'type' && 'Add a component'}
              {step === 'workload' && 'Add a workload'}
              {step === 'addon' && 'Add an addon'}
            </h2>
            <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              {step === 'type' && 'Append a new workload or addon to this running app.'}
              {step === 'workload' && 'A container (web service or worker).'}
              {step === 'addon' && 'A managed service such as postgres, redis, or rabbitmq.'}
            </p>
          </div>
          <button type="button" onClick={close} className="hover:opacity-70" style={{ color: 'var(--text-3)' }} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 'type' && (
            <div className="space-y-2.5">
              <TypeCard
                title="Workload"
                description="A web service or background worker container."
                icon={<Server className="h-4 w-4" style={{ color: 'var(--accent)' }} />}
                iconBg="var(--accent-soft)"
                onClick={() => setStep('workload')}
                testId="add-component-pick-workload"
              />
              <TypeCard
                title="Addon"
                description="A managed dependency like postgres or redis from your addon catalog."
                icon={<Database className="h-4 w-4" style={{ color: '#8b5cf6' }} />}
                iconBg="rgba(139,92,246,0.14)"
                onClick={() => setStep('addon')}
                testId="add-component-pick-addon"
              />
            </div>
          )}

          {step === 'workload' && (
            <WorkloadForm
              state={workload}
              onChange={setWorkload}
              addonRefs={addonRefs}
              addonDefinitions={addonDefinitions}
            />
          )}

          {step === 'addon' && (
            <AddonForm
              state={addon}
              onChange={setAddon}
              definitions={addonDefinitions}
              loading={addonDefsLoading}
            />
          )}

          {error && (
            <div
              className="rounded-md px-3 py-2 flex items-start gap-2 text-[12px]"
              style={{ background: 'var(--err-soft)', color: 'var(--err)' }}
              data-testid="add-component-error"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {step !== 'type' && (
          <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
            <Btn variant="ghost" size="sm" onClick={close} disabled={isPending}>Cancel</Btn>
            <Btn
              variant="primary"
              size="sm"
              onClick={step === 'workload' ? submitWorkload : submitAddon}
              disabled={isPending}
              data-testid={step === 'workload' ? 'add-component-submit-workload' : 'add-component-submit-addon'}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Adding…
                </>
              ) : step === 'workload' ? (
                'Add workload'
              ) : (
                'Add addon'
              )}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- internal sub-components ---------- */

function TypeCard({
  title,
  description,
  icon,
  iconBg,
  onClick,
  testId,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="w-full flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: iconBg }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{title}</p>
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>{description}</p>
      </div>
    </button>
  );
}

function WorkloadForm({
  state,
  onChange,
  addonRefs,
  addonDefinitions,
}: {
  state: WorkloadFormState;
  onChange: (next: WorkloadFormState) => void;
  addonRefs: Array<{ id: string; name: string; addon?: { definitionId: string } }>;
  addonDefinitions: AddonDefinition[];
}) {
  const update = (patch: Partial<WorkloadFormState>) => onChange({ ...state, ...patch });
  const updateEnv = (index: number, env: AppEnvVar) => {
    const next = [...state.env];
    next[index] = env;
    update({ env: next });
  };
  const removeEnv = (index: number) => update({ env: state.env.filter((_, i) => i !== index) });
  const addEnv = () => update({ env: [...state.env, { name: '', value: '' }] });
  const nameError = state.name.length > 0 && !k8sNameRegex.test(state.name);

  const kindBtn = (kind: WorkloadKind, label: string) => {
    const on = state.kind === kind;
    return (
      <button
        type="button"
        onClick={() =>
          update(
            kind === 'web-service'
              ? { kind, port: state.port || '8080' }
              : { kind, port: '', ingressEnabled: false, ingressHost: '' },
          )
        }
        style={{ background: on ? 'var(--accent)' : 'var(--surface-2)', color: on ? 'var(--on-accent)' : 'var(--text-2)' }}
        className="px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors hover:opacity-90"
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel required>Component name</FieldLabel>
        <TInput
          placeholder="api"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          data-testid="add-component-name"
        />
        {nameError && <p className="text-[11px] mt-1" style={{ color: 'var(--err)' }}>Lowercase letters, numbers, and hyphens only.</p>}
      </div>

      <div>
        <FieldLabel>Type</FieldLabel>
        <div className="flex gap-2 items-center">
          {kindBtn('web-service', 'Web service')}
          {kindBtn('worker', 'Worker')}
          <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
            {state.kind === 'web-service' ? <Globe className="h-3 w-3 inline mr-1" /> : <Cog className="h-3 w-3 inline mr-1" />}
            {state.kind === 'web-service' ? 'Exposes a port' : 'Background container, no port'}
          </span>
        </div>
      </div>

      <div>
        <FieldLabel required>Image</FieldLabel>
        <TInput
          placeholder="nginx:1.27-alpine"
          value={state.image}
          onChange={(e) => update({ image: e.target.value })}
          data-testid="add-component-image"
        />
      </div>

      <div className="flex gap-4">
        {state.kind === 'web-service' && (
          <div className="w-24">
            <FieldLabel>Port</FieldLabel>
            <TInput
              type="number"
              placeholder="8080"
              value={state.port}
              onChange={(e) => update({ port: e.target.value })}
              data-testid="add-component-port"
            />
          </div>
        )}
        <div className="w-24">
          <FieldLabel>Replicas</FieldLabel>
          <TInput
            type="number"
            min={0}
            max={100}
            value={state.replicas}
            onChange={(e) => update({ replicas: Number(e.target.value) || 0 })}
            data-testid="add-component-replicas"
          />
        </div>
      </div>

      {state.kind === 'web-service' && (
        <div>
          {!state.ingressEnabled ? (
            <button type="button" onClick={() => update({ ingressEnabled: true })} className="text-[12px] flex items-center gap-1 hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>
              <Plus className="h-3 w-3" /> Add a custom domain
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <FieldLabel>Domain</FieldLabel>
                <button type="button" onClick={() => update({ ingressEnabled: false, ingressHost: '' })} className="hover:opacity-70" style={{ color: 'var(--text-3)' }}>
                  <X className="h-3 w-3" />
                </button>
              </div>
              <TInput
                placeholder="app.example.com"
                value={state.ingressHost}
                onChange={(e) => update({ ingressHost: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Environment variables</FieldLabel>
          <button type="button" onClick={addEnv} className="text-[12px] flex items-center gap-1 hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {state.env.length > 0 && (
          <div className="space-y-2">
            {state.env.map((env, i) => (
              <EnvVarRow
                key={i}
                envVar={env}
                index={i}
                onUpdate={updateEnv}
                onRemove={removeEnv}
                addonComponents={addonRefs}
                addonDefinitions={addonDefinitions}
              />
            ))}
          </div>
        )}
        {addonRefs.length > 0 && (
          <p className="text-[10.5px] mt-2" style={{ color: 'var(--text-4)' }}>
            Tip: use the link icon on a row to inject a value exported by an addon already in this app
            (e.g. <span className="font-mono">DATABASE_URL</span> from a postgres component).
          </p>
        )}
      </div>
    </div>
  );
}

function AddonForm({
  state,
  onChange,
  definitions,
  loading,
}: {
  state: AddonFormState;
  onChange: (next: AddonFormState) => void;
  definitions: AddonDefinition[];
  loading: boolean;
}) {
  const update = (patch: Partial<AddonFormState>) => onChange({ ...state, ...patch });
  const nameError = state.name.length > 0 && !k8sNameRegex.test(state.name);
  const selectedDef = definitions.find((d) => d.id === state.definitionId);

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel required>Component name</FieldLabel>
        <TInput
          placeholder="db"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          data-testid="add-component-addon-name"
        />
        {nameError && <p className="text-[11px] mt-1" style={{ color: 'var(--err)' }}>Lowercase letters, numbers, and hyphens only.</p>}
      </div>

      <div>
        <FieldLabel required>Addon</FieldLabel>
        {loading ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            <Loader2 className="h-3 w-3 animate-spin" /> Loading addon catalog…
          </div>
        ) : definitions.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>
            No addon definitions are available in this cluster yet — ask an admin to seed the catalog
            (see addon-definitions in Settings).
          </p>
        ) : (
          <TSelect
            value={state.definitionId}
            onChange={(e) => {
              const next = e.target.value;
              const def = definitions.find((d) => d.id === next);
              update({ definitionId: next, name: state.name || def?.slug || '' });
            }}
            data-testid="add-component-addon-definition"
          >
            <option value="">Select an addon…</option>
            {definitions.map((def) => (
              <option key={def.id} value={def.id}>
                {def.name} ({def.type})
              </option>
            ))}
          </TSelect>
        )}
      </div>

      {selectedDef && (
        <div className="rounded-md p-3 space-y-1.5" style={{ background: 'var(--surface-2)' }}>
          <p className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{selectedDef.name}</p>
          {selectedDef.description && (
            <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{selectedDef.description}</p>
          )}
          {selectedDef.chart_config && (
            <p className="text-[10.5px] font-mono" style={{ color: 'var(--text-4)' }}>
              {selectedDef.chart_config.name}:{selectedDef.chart_config.version}
            </p>
          )}
          {selectedDef.export_schema && Object.keys(selectedDef.export_schema).length > 0 && (
            <div>
              <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-3)' }}>Exports to workloads:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.keys(selectedDef.export_schema).map((key) => (
                  <span key={key} className="px-2 py-0.5 rounded text-[10.5px] font-mono" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>{key}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <FieldLabel>Values overrides (optional JSON)</FieldLabel>
        <textarea
          value={state.valuesJson}
          onChange={(e) => update({ valuesJson: e.target.value })}
          rows={6}
          spellCheck={false}
          className="w-full rounded-md border px-2.5 py-1.5 text-[11.5px] font-mono focus:outline-none focus:border-[var(--accent)]"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          data-testid="add-component-addon-values"
        />
        <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-4)' }}>
          Merged into the Helm release values for the addon chart.
        </p>
      </div>
    </div>
  );
}

/**
 * Best-effort: match an existing addon component on the app to a known
 * addon definition by chart name. The app's read-side component shape
 * (`AppReadComponent`) is currently a thin {name, type} record, so we can
 * only return a definition if the catalog is small enough to disambiguate
 * by name alone — otherwise the export_ref picker will simply list the
 * component without exports, which the EnvVarRow already handles gracefully.
 */
function matchDefinitionForComponent(
  component: AppReadComponent,
  definitions: AddonDefinition[],
): AddonDefinition | undefined {
  if (component.type !== 'addon') return undefined;
  // The component name often mirrors the addon slug (e.g. "db" or "postgres").
  return definitions.find((d) => d.slug === component.name) ?? undefined;
}
