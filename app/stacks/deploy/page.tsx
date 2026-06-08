'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Layers, Loader2, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useStackTemplate, useDeployStackTemplate } from '@/hooks/useStackTemplates';
import { apiClient } from '@/lib/api-client';
import { Btn, Card, Pill } from '@/components/shell/primitives';
import type {
  ParameterSpec,
  StackTemplateComponent,
} from '@/lib/api/stack-templates';
import type { ProjectListResponse } from '@/types/api';

interface ChartInfo {
  name: string;
  version: string;
}

/**
 * Pull a chart {name, version} from a template component, regardless of
 * whether it lives on `workloadSpec.chart` (chart-mode workloads, kn-fzw) or
 * `addonSpec.chart` (always chart-shaped). Returns null for image-mode
 * workloads so the caller renders the existing `name · type` pill.
 */
function getComponentChartSpec(component: StackTemplateComponent): ChartInfo | null {
  const candidates: Array<Record<string, unknown> | undefined> = [
    component.workloadSpec as Record<string, unknown> | undefined,
    component.addonSpec as Record<string, unknown> | undefined,
  ];
  for (const spec of candidates) {
    if (!spec) continue;
    const chart = spec.chart;
    if (chart && typeof chart === 'object') {
      const c = chart as Record<string, unknown>;
      const name = typeof c.name === 'string' ? c.name : '';
      const version = typeof c.version === 'string' ? c.version : '';
      if (name || version) return { name, version };
    }
  }
  return null;
}

/**
 * Coerce a parameter's raw user input to the type the backend expects.
 * Returns undefined when the user didn't provide a value so callers can omit
 * the key entirely (letting the backend apply its default / generator).
 */
function coerceParamValue(spec: ParameterSpec, raw: string | undefined): unknown {
  if (raw === undefined || raw === '') return undefined;
  if (spec.type === 'integer') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  if (spec.type === 'boolean') return raw === 'true';
  return raw;
}

function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`h-8 w-full rounded-md border px-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] ${className}`}
    />
  );
}
function TSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', style, children, ...rest } = props;
  return (
    <select
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`h-9 w-full rounded-md border px-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] ${className}`}
    >
      {children}
    </select>
  );
}

export default function StackDeployPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-[13px]" style={{ color: 'var(--text-3)' }}>Loading…</div>}>
      <StackDeployForm />
    </Suspense>
  );
}

function StackDeployForm() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const ns = searchParams.get('ns') || '';
  const name = searchParams.get('name') || '';
  const presetProjectId = searchParams.get('project_id') || '';

  const { data: template, isLoading: templateLoading } = useStackTemplate(ns, name);

  const [selectedProjectId, setSelectedProjectId] = useState(presetProjectId);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [deployed, setDeployed] = useState(false);
  const [deployResult, setDeployResult] = useState<{ deploy_name: string; namespace: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deployMutation = useDeployStackTemplate(ns, name);

  const { data: projectsData } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => apiClient.get<ProjectListResponse>('/projects'),
  });
  const projects = projectsData?.data ?? [];

  const parameters = template?.parameters ?? {};
  const paramEntries = Object.entries(parameters);

  const handleDeploy = () => {
    if (!selectedProjectId) return;
    setError(null);

    const resolvedParams: Record<string, unknown> = {};
    for (const [key, spec] of paramEntries) {
      const coerced = coerceParamValue(spec, paramValues[key]);
      if (coerced !== undefined) resolvedParams[key] = coerced;
    }

    deployMutation.mutate(
      { project_id: selectedProjectId, parameters: Object.keys(resolvedParams).length > 0 ? resolvedParams : undefined },
      {
        onSuccess: (result) => {
          setDeployed(true);
          setDeployResult(result);
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Deployment failed'),
      },
    );
  };

  if (!isAuthenticated) return null;

  if (templateLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-3)' }} />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="px-6 py-8 max-w-[640px] mx-auto space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-[12.5px] hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <Card><p className="text-[13px]" style={{ color: 'var(--text-3)' }}>Template not found. Check the namespace and name, or browse the catalog.</p></Card>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 max-w-[640px] mx-auto space-y-4">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-[12.5px] hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div>
        <h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Layers className="h-5 w-5" style={{ color: 'var(--accent)' }} /> Deploy {template.name}
        </h1>
        {template.description && <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-3)' }}>{template.description}</p>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {template.components.map((c) => {
            const chart = getComponentChartSpec(c);
            if (chart) {
              const versionSuffix = chart.version ? ` @ ${chart.version}` : '';
              return (
                <span
                  key={c.name}
                  title="External Helm chart — image/replicas/port/ingress fields don't apply"
                  data-testid={`deploy-component-chart-${c.name}`}
                >
                  <Pill tone="accent" size="sm">
                    <Package className="h-3 w-3" />
                    <span>{c.name} · Chart: {chart.name || '(unnamed)'}{versionSuffix}</span>
                  </Pill>
                </span>
              );
            }
            return (
              <Pill key={c.name} tone="default" size="sm">{c.name} · {c.type}</Pill>
            );
          })}
        </div>
      </div>

      {deployed ? (
        <Card>
          <div className="text-center space-y-3 py-2">
            <CheckCircle2 className="h-11 w-11 mx-auto" style={{ color: 'var(--ok)' }} />
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text)' }}>App created from template</h2>
            <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              <span className="font-mono" style={{ color: 'var(--text-2)' }}>{deployResult?.deploy_name}</span> is deploying in <span className="font-mono">{deployResult?.namespace}</span>. It carries the “via template” badge.
            </p>
            <div className="flex gap-2 justify-center pt-1">
              {deployResult && selectedProjectId && (
                <Btn variant="primary" size="sm" onClick={() => router.push(`/apps/${deployResult.namespace}/${deployResult.deploy_name}?project_id=${selectedProjectId}`)}>View app</Btn>
              )}
              <Btn variant="default" size="sm" onClick={() => router.push('/apps')}>All apps</Btn>
              <Btn variant="ghost" size="sm" onClick={() => router.push('/settings/stack-templates')}>Deploy another</Btn>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4">
            <div>
              <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>Target project <span style={{ color: 'var(--err)' }}>*</span></label>
              <TSelect value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.namespace})</option>
                ))}
              </TSelect>
            </div>

            {paramEntries.length > 0 && (
              <div className="space-y-3">
                <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Answer the template’s parameters:</p>
                {paramEntries.map(([key, spec]) => (
                  <ParameterField
                    key={key}
                    paramKey={key}
                    spec={spec}
                    rawValue={paramValues[key]}
                    onChange={(next) => setParamValues({ ...paramValues, [key]: next })}
                  />
                ))}
              </div>
            )}

            {error && <div className="rounded-md px-3 py-2 text-[12.5px]" style={{ background: 'var(--err-soft)', color: 'var(--err)' }}>{error}</div>}

            <Btn variant="primary" size="md" className="w-full" onClick={handleDeploy} disabled={deployMutation.isPending || !selectedProjectId}>
              {deployMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Deploying…</> : 'Deploy from template'}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Renders a single ParameterSpec as the appropriate input:
 *   - boolean              → checkbox, initial visual = `spec.default`
 *   - string + enum (>=1)  → <select> with the enum options
 *   - integer              → number input
 *   - string (no enum)     → text input
 *
 * `rawValue` is the user-touched value (string); `undefined` means untouched
 * and the caller's submit pass will omit the key so the backend applies its
 * default or generator. Generator-backed string params show a placeholder
 * inviting the user to leave the field blank.
 */
function ParameterField({
  paramKey,
  spec,
  rawValue,
  onChange,
}: {
  paramKey: string;
  spec: ParameterSpec;
  rawValue: string | undefined;
  onChange: (next: string) => void;
}) {
  const inputId = `p-${paramKey}`;
  const requiredMark = spec.required && (
    <span style={{ color: 'var(--err)' }} className="ml-0.5" aria-hidden>*</span>
  );
  const requiredA11yLabel = spec.required ? ' (required)' : '';

  const generatorHint = spec.generator
    ? `leave blank to auto-generate (${spec.generator})`
    : null;
  const defaultHint =
    spec.default !== undefined && spec.default !== null && spec.default !== ''
      ? String(spec.default)
      : null;
  // Generator-backed params explicitly direct users to leave the field empty,
  // so prefer that hint over the (often empty) default value.
  const placeholder = generatorHint ?? defaultHint ?? '';

  const stringEnum = spec.type === 'string' && Array.isArray(spec.enum) && spec.enum.length > 0
    ? spec.enum
    : null;

  let input: React.ReactNode;
  if (spec.type === 'boolean') {
    // Untouched: the visual reflects `spec.default` but the value stays
    // undefined upstream, so the submit pass omits the key and the backend
    // applies its default. The first click stamps an explicit 'true'/'false'.
    const visualChecked = rawValue === undefined
      ? Boolean(spec.default)
      : rawValue === 'true';
    input = (
      <label className="inline-flex items-center gap-2 text-[12.5px]" htmlFor={inputId} style={{ color: 'var(--text-2)' }}>
        <input
          id={inputId}
          type="checkbox"
          checked={visualChecked}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          aria-label={`${paramKey}${requiredA11yLabel}`}
          data-testid={`deploy-param-${paramKey}`}
        />
        <span>{visualChecked ? 'true' : 'false'}</span>
      </label>
    );
  } else if (stringEnum) {
    input = (
      <TSelect
        id={inputId}
        value={rawValue ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${paramKey}${requiredA11yLabel}`}
        data-testid={`deploy-param-${paramKey}`}
      >
        <option value="">
          {defaultHint ? `Default: ${defaultHint}` : 'Select…'}
        </option>
        {stringEnum.map((option) => (
          <option key={String(option)} value={String(option)}>{String(option)}</option>
        ))}
      </TSelect>
    );
  } else {
    input = (
      <TInput
        id={inputId}
        type={spec.type === 'integer' ? 'number' : 'text'}
        placeholder={placeholder}
        value={rawValue ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${paramKey}${requiredA11yLabel}`}
        data-testid={`deploy-param-${paramKey}`}
      />
    );
  }

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-[11.5px] font-medium block" style={{ color: 'var(--text-3)' }}>
        {paramKey}
        {requiredMark}
        {!spec.required && spec.generator && (
          <span className="ml-1 text-[10.5px] font-normal" style={{ color: 'var(--text-4)' }}>
            (optional)
          </span>
        )}
      </label>
      {input}
      {spec.description && (
        <p className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>{spec.description}</p>
      )}
      {spec.generator && (
        <p className="text-[10.5px]" style={{ color: 'var(--accent)' }}>
          Auto-generated ({spec.generator}) if left blank
        </p>
      )}
    </div>
  );
}
