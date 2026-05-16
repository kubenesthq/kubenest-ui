'use client';

/**
 * Drawer for attaching a standalone addon instance's exports into this app's
 * workload components (kn-gfa). Two steps:
 *
 *   1. Pick a project-scoped addon instance (e.g. a postgres running in the
 *      same project as the nginx app you're editing).
 *   2. For each export key the addon publishes (DATABASE_URL, HOST, …),
 *      choose a workload component and an env-var name to inject. Anything
 *      the user un-toggles is dropped from the request body so the backend
 *      doesn't have to scrub it later.
 *
 * Important: this drawer does NOT add the addon as a StackDeploy component
 * — it only writes env vars via `valueFrom.exportRef`. To also see the
 * addon as a card on the overview tab, use the Add-component drawer
 * (kn-a4l) first, then attach. The drawer surfaces this distinction in a
 * help banner so users don't get confused about why their attached addon
 * doesn't appear as a row.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { addonDefinitionsApi, addonInstancesApi } from '@/lib/api/addons';
import { ApiClientError } from '@/lib/api-client';
import { Btn } from '@/components/shell/primitives';
import { FieldLabel, TInput, TSelect } from './form-controls';
import type {
  AddonDefinition,
  AddonEnvMapping,
  AddonInstance,
  AppReadComponent,
} from '@/types/api';

interface MappingDraft {
  exportKey: string;
  description?: string;
  workloadComponent: string;
  envVarName: string;
  enabled: boolean;
}

function attachErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const detail = error.detail as Record<string, unknown> | null;
    const code = detail && typeof detail.code === 'string' ? detail.code : undefined;
    if (code === 'unknown_export_key') {
      const keys = Array.isArray((detail as Record<string, unknown>).invalid_export_keys)
        ? ((detail as Record<string, unknown>).invalid_export_keys as string[]).join(', ')
        : '';
      return `The addon doesn't publish ${keys || 'those'} export keys. Pick the available ones above and retry.`;
    }
    const detailMessage = detail && typeof detail.message === 'string' ? detail.message : undefined;
    return detailMessage ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to attach addon';
}

export function AttachAddonDrawer({
  open,
  onClose,
  isPending,
  projectId,
  workloadComponents,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  isPending: boolean;
  projectId: string;
  /** Subset of app.components filtered to workloads — addons can't receive injections. */
  workloadComponents: AppReadComponent[];
  /** Caller-owned promise; drawer closes only after it resolves. */
  onAttach: (vars: { addonInstanceId: string; envMappings: AddonEnvMapping[] }) => Promise<void>;
}) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [mappings, setMappings] = useState<MappingDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['addon-instances', projectId],
    queryFn: () => addonInstancesApi.list(projectId),
    enabled: open && Boolean(projectId),
  });
  const addonInstances: AddonInstance[] = useMemo(
    () => instancesData?.data ?? [],
    [instancesData],
  );

  const selectedInstance = addonInstances.find((a) => a.id === selectedInstanceId) ?? null;

  // Definition lookup so we can render export-schema keys (the source of
  // truth for what mappings are even possible). For custom addons with no
  // definition, fall through to whatever `instance.exports` happens to have.
  const { data: selectedDefinition } = useQuery<AddonDefinition | null>({
    queryKey: ['addon-definition', selectedInstance?.definition_id ?? null],
    queryFn: async () => {
      if (!selectedInstance?.definition_id) return null;
      return addonDefinitionsApi.get(selectedInstance.definition_id);
    },
    enabled: open && Boolean(selectedInstance?.definition_id),
  });

  // Derive the set of available export keys from the definition's schema,
  // falling back to keys present on the instance's exports payload.
  const exportEntries: Array<{ key: string; description?: string }> = useMemo(() => {
    if (!selectedInstance) return [];
    const schema = selectedDefinition?.export_schema;
    if (schema && Object.keys(schema).length > 0) {
      return Object.entries(schema).map(([key, entry]) => ({
        key,
        description: entry?.description ?? undefined,
      }));
    }
    const instanceKeys = Object.keys(selectedInstance.exports ?? {});
    return instanceKeys.map((key) => ({ key }));
  }, [selectedInstance, selectedDefinition]);

  // Seed the mapping rows when a new addon instance is selected. This is
  // explicitly a derive-from-props pattern that the lint can't see through
  // (mappings need user-edited state per row, so they can't just be
  // useMemo'd off the props each render).
  useEffect(() => {
    if (!selectedInstance) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local mapping drafts when the user clears the addon picker
      setMappings([]);
      return;
    }
    const defaultComponent = workloadComponents[0]?.name ?? '';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding local mapping drafts from a freshly picked addon instance
    setMappings(
      exportEntries.map((entry) => ({
        exportKey: entry.key,
        description: entry.description,
        workloadComponent: defaultComponent,
        envVarName: entry.key,
        enabled: true,
      })),
    );
  }, [selectedInstance, exportEntries, workloadComponents]);

  if (!open) return null;

  const close = () => {
    setSelectedInstanceId('');
    setMappings([]);
    setError(null);
    onClose();
  };

  const updateMapping = (index: number, patch: Partial<MappingDraft>) => {
    setMappings((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const submit = async () => {
    setError(null);
    if (!selectedInstance) return setError('Pick an addon instance.');
    const checked = mappings.filter((m) => m.enabled);
    if (checked.length === 0) return setError('Enable at least one mapping to attach.');

    const envMappings: AddonEnvMapping[] = [];
    for (const m of checked) {
      if (!m.workloadComponent) return setError(`Pick a target component for ${m.exportKey}.`);
      const envName = m.envVarName.trim();
      if (!envName) return setError(`Provide an env-var name for ${m.exportKey}.`);
      envMappings.push({
        workload_component: m.workloadComponent,
        env_var_name: envName,
        export_key: m.exportKey,
      });
    }

    try {
      await onAttach({ addonInstanceId: selectedInstance.id, envMappings });
      close();
    } catch (err) {
      setError(attachErrorMessage(err));
    }
  };

  const noWorkloads = workloadComponents.length === 0;

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
        aria-label="Attach addon"
        className="w-full sm:w-[560px] sm:h-full flex flex-col anim-slide-up"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)' }}
      >
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.14)' }}>
            <Database className="h-4 w-4" style={{ color: '#8b5cf6' }} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Attach an addon</h2>
            <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              Inject env vars from a standalone addon instance into this app&apos;s workloads.
            </p>
          </div>
          <button type="button" onClick={close} className="hover:opacity-70" style={{ color: 'var(--text-3)' }} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div
            className="rounded-md px-3 py-2 text-[11.5px] flex items-start gap-2"
            style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Attach only wires env vars (via <span className="font-mono">valueFrom.exportRef</span>).
              The addon does <strong>not</strong> appear as a component on this app&apos;s overview.
              If you also want it managed from here, use <em>Add a component</em> first, then attach.
            </span>
          </div>

          <div>
            <FieldLabel required>Addon instance</FieldLabel>
            {instancesLoading ? (
              <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
                <Loader2 className="h-3 w-3 animate-spin" /> Loading addon instances…
              </div>
            ) : addonInstances.length === 0 ? (
              <div
                className="rounded-md px-3 py-2 text-[12px] flex items-center gap-2"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}
              >
                <span>No addons in this project yet.</span>
                <Link
                  href={`/projects/${projectId}/addons/new`}
                  className="inline-flex items-center gap-1 hover:text-[var(--text)]"
                  style={{ color: 'var(--accent)' }}
                >
                  Provision one <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <TSelect
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                data-testid="attach-addon-instance"
              >
                <option value="">Select an addon…</option>
                {addonInstances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} · {inst.type}{inst.phase ? ` (${inst.phase})` : ''}
                  </option>
                ))}
              </TSelect>
            )}
          </div>

          {selectedInstance && noWorkloads && (
            <div
              className="rounded-md px-3 py-2 text-[12px] flex items-start gap-2"
              style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                This app has no workload components — there&apos;s nothing for an addon to inject env vars into.
                Add a workload first.
              </span>
            </div>
          )}

          {selectedInstance && !noWorkloads && (
            <div>
              <FieldLabel>Map exports → workload env vars</FieldLabel>
              {mappings.length === 0 ? (
                <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                  This addon doesn&apos;t publish any exports yet (instance is still starting up, or the
                  definition has no <span className="font-mono">export_schema</span>). Wait for it to
                  finish provisioning and re-open this drawer.
                </p>
              ) : (
                <div className="space-y-2">
                  {mappings.map((mapping, index) => (
                    <div
                      key={mapping.exportKey}
                      className="rounded-md border p-2.5 space-y-1.5"
                      style={{ borderColor: 'var(--border)' }}
                      data-testid={`attach-addon-mapping-${mapping.exportKey}`}
                    >
                      <div className="flex items-center gap-2 text-[12px]">
                        <input
                          type="checkbox"
                          checked={mapping.enabled}
                          onChange={(e) => updateMapping(index, { enabled: e.target.checked })}
                          aria-label={`Include ${mapping.exportKey}`}
                          data-testid={`attach-addon-toggle-${mapping.exportKey}`}
                        />
                        <span className="font-mono font-medium" style={{ color: 'var(--text)' }}>
                          {mapping.exportKey}
                        </span>
                        {mapping.description && (
                          <span className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>
                            {mapping.description}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 pl-6">
                        <ArrowRight className="h-3 w-3 shrink-0" style={{ color: 'var(--text-4)' }} />
                        <TSelect
                          disabled={!mapping.enabled}
                          value={mapping.workloadComponent}
                          onChange={(e) => updateMapping(index, { workloadComponent: e.target.value })}
                          className="!w-40"
                          data-testid={`attach-addon-component-${mapping.exportKey}`}
                        >
                          {workloadComponents.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </TSelect>
                        <TInput
                          disabled={!mapping.enabled}
                          value={mapping.envVarName}
                          onChange={(e) => updateMapping(index, { envVarName: e.target.value })}
                          placeholder="ENV_VAR_NAME"
                          className="font-mono"
                          data-testid={`attach-addon-envname-${mapping.exportKey}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {mappings.some((m) => m.enabled) && (
                <p
                  className="text-[10.5px] mt-2 flex items-center gap-1.5"
                  style={{ color: 'var(--text-3)' }}
                >
                  <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--ok)' }} />
                  Ready to attach {mappings.filter((m) => m.enabled).length} env var
                  {mappings.filter((m) => m.enabled).length === 1 ? '' : 's'}.
                </p>
              )}
            </div>
          )}

          {error && (
            <div
              className="rounded-md px-3 py-2 flex items-start gap-2 text-[12px]"
              style={{ background: 'var(--err-soft)', color: 'var(--err)' }}
              data-testid="attach-addon-error"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <Btn variant="ghost" size="sm" onClick={close} disabled={isPending}>Cancel</Btn>
          <Btn
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={
              isPending
              || !selectedInstance
              || noWorkloads
              || mappings.length === 0
              || !mappings.some((m) => m.enabled)
            }
            data-testid="attach-addon-submit"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Attaching…
              </>
            ) : (
              'Attach addon'
            )}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/**
 * Scan a workload's env vars and group them by `export_ref.component` so the
 * overview row can render a "Linked: {addon}" chip with one detach per group.
 * Used by the page-level detach UI; kept here for reuse + isolation.
 */
export interface LinkedAddonGroup {
  /** export_ref.component value — matches an addon instance's name. */
  componentName: string;
  /** Resolved addon-instance id (best-effort by name match in this project), undefined if not found. */
  addonInstanceId: string | undefined;
  /** Per-env-var detail for tooltip/dialog wording. */
  envVars: Array<{ envVarName: string; exportKey: string }>;
}

export function linkedAddonGroupsFor(
  component: AppReadComponent,
  addonInstances: AddonInstance[],
): LinkedAddonGroup[] {
  const spec = component.workload_spec;
  if (!spec || typeof spec !== 'object') return [];
  const env = (spec as Record<string, unknown>).env;
  if (!Array.isArray(env)) return [];

  const buckets = new Map<string, LinkedAddonGroup>();
  for (const entry of env) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const ref = extractExportRef(e);
    if (!ref) continue;
    const { component: componentName, exportKey } = ref;
    const envVarName = typeof e.name === 'string' ? e.name : null;
    if (!envVarName) continue;

    let bucket = buckets.get(componentName);
    if (!bucket) {
      const matchedInstance = addonInstances.find((inst) => inst.name === componentName);
      bucket = {
        componentName,
        addonInstanceId: matchedInstance?.id,
        envVars: [],
      };
      buckets.set(componentName, bucket);
    }
    bucket.envVars.push({ envVarName, exportKey });
  }

  return Array.from(buckets.values());
}

/**
 * Read an export_ref from an env-var entry in either of the two shapes that
 * appear in this codebase:
 *
 *   - **App-create / patch payload**: `{ name, export_ref: { component, export_key } }`
 *   - **GET /apps response (raw CR)**: `{ name, valueFrom: { exportRef: { component, key } } }`
 *     (the operator translates the create-flow shape into the CR shape via
 *      kn-a8m, so the read-side payload always uses `valueFrom.exportRef.key`.)
 *
 * Returning a normalized shape lets callers stay shape-agnostic.
 */
export function extractExportRef(envEntry: Record<string, unknown>): { component: string; exportKey: string } | null {
  // Create-flow shape (kept for symmetry with the EnvVarRow / drafts paths).
  const direct = envEntry.export_ref;
  if (direct && typeof direct === 'object') {
    const r = direct as Record<string, unknown>;
    if (typeof r.component === 'string' && typeof r.export_key === 'string') {
      return { component: r.component, exportKey: r.export_key };
    }
  }
  // Read-side CR shape.
  const valueFrom = envEntry.valueFrom;
  if (valueFrom && typeof valueFrom === 'object') {
    const vf = valueFrom as Record<string, unknown>;
    const ref = vf.exportRef;
    if (ref && typeof ref === 'object') {
      const r = ref as Record<string, unknown>;
      if (typeof r.component === 'string') {
        const exportKey = typeof r.key === 'string' ? r.key : typeof r.export_key === 'string' ? r.export_key : null;
        if (exportKey) return { component: r.component, exportKey };
      }
    }
  }
  return null;
}
