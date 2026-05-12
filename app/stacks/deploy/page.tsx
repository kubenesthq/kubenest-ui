'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Layers, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useStackTemplate, useDeployStackTemplate } from '@/hooks/useStackTemplates';
import { apiClient } from '@/lib/api-client';
import { Btn, Card, Pill } from '@/components/shell/primitives';
import type { ProjectListResponse } from '@/types/api';

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
      const userVal = paramValues[key];
      if (userVal !== undefined && userVal !== '') {
        resolvedParams[key] = spec.type === 'integer' ? parseInt(userVal, 10) : spec.type === 'boolean' ? userVal === 'true' : userVal;
      }
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
          {template.components.map((c) => (
            <Pill key={c.name} tone="default" size="sm">{c.name} · {c.type}</Pill>
          ))}
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
                  <div key={key} className="space-y-1">
                    <label htmlFor={`p-${key}`} className="text-[11.5px] font-medium block" style={{ color: 'var(--text-3)' }}>
                      {key}{spec.required && <span style={{ color: 'var(--err)' }} className="ml-0.5">*</span>}
                    </label>
                    {spec.type === 'boolean' ? (
                      <TSelect value={paramValues[key] ?? String(spec.default ?? 'false')} onChange={(e) => setParamValues({ ...paramValues, [key]: e.target.value })}>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </TSelect>
                    ) : (
                      <TInput
                        id={`p-${key}`}
                        type={spec.type === 'integer' ? 'number' : 'text'}
                        placeholder={spec.default !== undefined ? String(spec.default) : ''}
                        value={paramValues[key] ?? ''}
                        onChange={(e) => setParamValues({ ...paramValues, [key]: e.target.value })}
                      />
                    )}
                    {spec.description && <p className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>{spec.description}</p>}
                    {spec.generator && <p className="text-[10.5px]" style={{ color: 'var(--accent)' }}>Auto-generated ({spec.generator}) if left blank</p>}
                  </div>
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
