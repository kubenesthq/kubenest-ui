'use client';

import { Suspense, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Cog,
  Database,
  Globe,
  Layers,
  Link2,
  Plus,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import { getAllProjects } from '@/api/projects';
import { addonDefinitionsApi } from '@/lib/api/addons';
import { stackTemplatesApi } from '@/lib/api/stack-templates';
import { useCreateApp } from '@/hooks/useApps';
import { Btn, Card, SectionLabel } from '@/components/shell/primitives';
import type {
  AddonDefinition,
  AddonType,
  AppComponent,
  AppEnvVar,
  AppComponentType,
  ChartSpec,
} from '@/types/api';

/* ---------- token-styled form controls ---------- */

function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`h-8 w-full rounded-md border px-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 ${className}`}
    />
  );
}

function TSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', style, children, ...rest } = props;
  return (
    <select
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`h-9 w-full rounded-md border px-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 ${className}`}
    >
      {children}
    </select>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>
      {children}
      {required && <span style={{ color: 'var(--err)' }} className="ml-0.5">*</span>}
    </label>
  );
}

/* ---------- component name validation ---------- */

const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/* ---------- form buffer types ---------- */

type WorkloadKind = 'web-service' | 'worker';

interface WorkloadFormData {
  image: string;
  replicas: number;
  port: number | null;
  ingressEnabled: boolean;
  ingressHost: string;
  env: AppEnvVar[];
  kind: WorkloadKind;
}

interface AddonFormData {
  definitionId: string;
  addonType: string;
  chart: ChartSpec;
  values: Record<string, unknown>;
}

interface ComponentEntry {
  id: string;
  name: string;
  type: AppComponentType;
  workload?: WorkloadFormData;
  addon?: AddonFormData;
  collapsed: boolean;
}

/* ---------- env var row (with product-term export-ref linking) ---------- */

function EnvVarRow({
  envVar,
  index,
  onUpdate,
  onRemove,
  addonComponents,
  addonDefinitions,
}: {
  envVar: AppEnvVar;
  index: number;
  onUpdate: (index: number, env: AppEnvVar) => void;
  onRemove: (index: number) => void;
  addonComponents: ComponentEntry[];
  addonDefinitions: AddonDefinition[];
}) {
  const [showExportPicker, setShowExportPicker] = useState(false);
  const isLinked = !!envVar.export_ref;
  const brokenRef = isLinked && !addonComponents.some((c) => c.name === envVar.export_ref!.component);

  return (
    <div className="flex items-start gap-2 group">
      <div className="flex-1 min-w-0">
        <TInput
          placeholder="KEY"
          value={envVar.name}
          onChange={(e) => onUpdate(index, { ...envVar, name: e.target.value })}
          className="font-mono"
        />
      </div>
      <div className="flex-1 min-w-0 relative">
        {isLinked ? (
          <div
            className="h-8 px-2.5 rounded-md border text-[12px] flex items-center gap-1.5"
            style={
              brokenRef
                ? { background: 'var(--warn-soft)', borderColor: 'var(--warn)', color: 'var(--warn)' }
                : { background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent)' }
            }
          >
            {brokenRef ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <Link2 className="h-3 w-3 shrink-0" />}
            <span className="truncate">
              {envVar.export_ref!.export_key} from component {envVar.export_ref!.component}
            </span>
            <button
              type="button"
              onClick={() => onUpdate(index, { name: envVar.name, value: '', export_ref: undefined })}
              className="ml-auto shrink-0 hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <TInput
            placeholder="value"
            value={envVar.value ?? ''}
            onChange={(e) => onUpdate(index, { ...envVar, value: e.target.value })}
            className="font-mono"
          />
        )}
      </div>

      {!isLinked && addonComponents.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportPicker(!showExportPicker)}
            className="h-8 w-8 rounded-md border flex items-center justify-center hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
            title="Use a value exported by another component"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>

          {showExportPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportPicker(false)} />
              <div
                className="absolute right-0 top-9 z-20 w-72 rounded-lg border py-1 max-h-64 overflow-y-auto anim-slide-up"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
              >
                <p className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                  Use a value exported by a component
                </p>
                {addonComponents.map((comp) => {
                  const def = addonDefinitions.find((d) => d.id === comp.addon?.definitionId);
                  const exports = def?.export_schema;
                  if (!exports || Object.keys(exports).length === 0) return null;
                  return (
                    <div key={comp.id}>
                      <p className="px-3 py-1 text-[11.5px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                        {comp.name} <span style={{ color: 'var(--text-4)' }}>({def?.name})</span>
                      </p>
                      {Object.entries(exports).map(([key, schema]) => (
                        <button
                          key={key}
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-[12px] hover:bg-[var(--surface-2)] flex items-center justify-between"
                          onClick={() => {
                            onUpdate(index, { name: envVar.name || key, export_ref: { component: comp.name, export_key: key } });
                            setShowExportPicker(false);
                          }}
                        >
                          <span className="font-mono" style={{ color: 'var(--text)' }}>{key}</span>
                          <span className="truncate ml-2" style={{ color: 'var(--text-4)' }}>{schema.description}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="h-8 w-8 rounded-md flex items-center justify-center hover:text-[var(--err)] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-4)' }}
        aria-label="Remove env var"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ---------- workload component card ---------- */

function ComponentCardShell({
  collapsed,
  onToggleCollapse,
  onRemove,
  iconBg,
  icon,
  title,
  subtitle,
  children,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onRemove: () => void;
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card flush className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: iconBg }}>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{title}</p>
          <p className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>{subtitle}</p>
        </div>
        <button type="button" onClick={onToggleCollapse} className="hover:opacity-70" style={{ color: 'var(--text-3)' }}>
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onRemove} className="hover:text-[var(--err)]" style={{ color: 'var(--text-4)' }}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {!collapsed && <div className="px-4 py-4 space-y-4">{children}</div>}
    </Card>
  );
}

function WorkloadCard({
  component,
  onUpdate,
  onRemove,
  onToggleCollapse,
  addonComponents,
  addonDefinitions,
}: {
  component: ComponentEntry;
  onUpdate: (updated: ComponentEntry) => void;
  onRemove: () => void;
  onToggleCollapse: () => void;
  addonComponents: ComponentEntry[];
  addonDefinitions: AddonDefinition[];
}) {
  const w = component.workload!;
  const updateWorkload = (patch: Partial<WorkloadFormData>) => onUpdate({ ...component, workload: { ...w, ...patch } });
  const updateName = (name: string) => onUpdate({ ...component, name });
  const updateEnv = (index: number, env: AppEnvVar) => {
    const next = [...w.env];
    next[index] = env;
    updateWorkload({ env: next });
  };
  const removeEnv = (index: number) => updateWorkload({ env: w.env.filter((_, i) => i !== index) });
  const addEnv = () => updateWorkload({ env: [...w.env, { name: '', value: '' }] });
  const nameError = component.name.length > 0 && !k8sNameRegex.test(component.name);

  const kindBtn = (kind: WorkloadKind, label: string, onClick: () => void) => {
    const on = w.kind === kind;
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ background: on ? 'var(--accent)' : 'var(--surface-2)', color: on ? 'var(--on-accent)' : 'var(--text-2)' }}
        className="px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors hover:opacity-90"
      >
        {label}
      </button>
    );
  };

  return (
    <ComponentCardShell
      collapsed={component.collapsed}
      onToggleCollapse={onToggleCollapse}
      onRemove={onRemove}
      iconBg="var(--accent-soft)"
      icon={w.kind === 'web-service' ? <Globe className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} /> : <Cog className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />}
      title={component.name || 'Unnamed workload'}
      subtitle={w.kind === 'web-service' ? 'Web service' : 'Worker'}
    >
      <div>
        <FieldLabel required>Component name</FieldLabel>
        <TInput placeholder="api" value={component.name} onChange={(e) => updateName(e.target.value)} />
        {nameError && <p className="text-[11px] mt-1" style={{ color: 'var(--err)' }}>Lowercase letters, numbers, and hyphens only</p>}
      </div>

      <div>
        <FieldLabel>Type</FieldLabel>
        <div className="flex gap-2">
          {kindBtn('web-service', 'Web service', () => updateWorkload({ kind: 'web-service', port: w.port ?? 8080 }))}
          {kindBtn('worker', 'Worker', () => updateWorkload({ kind: 'worker', port: null, ingressEnabled: false, ingressHost: '' }))}
        </div>
      </div>

      <div>
        <FieldLabel required>Image</FieldLabel>
        <TInput placeholder="myapp:latest" value={w.image} onChange={(e) => updateWorkload({ image: e.target.value })} />
      </div>

      <div className="flex gap-4">
        {w.kind === 'web-service' && (
          <div className="w-24">
            <FieldLabel>Port</FieldLabel>
            <TInput type="number" placeholder="8080" value={w.port ?? ''} onChange={(e) => updateWorkload({ port: e.target.value ? Number(e.target.value) : null })} />
          </div>
        )}
        <div className="w-24">
          <FieldLabel>Replicas</FieldLabel>
          <TInput type="number" min={1} max={10} value={w.replicas} onChange={(e) => updateWorkload({ replicas: Number(e.target.value) || 1 })} />
        </div>
      </div>

      {w.kind === 'web-service' && (
        <div>
          {!w.ingressEnabled ? (
            <button type="button" onClick={() => updateWorkload({ ingressEnabled: true })} className="text-[12px] flex items-center gap-1 hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>
              <Plus className="h-3 w-3" /> Add a custom domain
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <FieldLabel>Domain</FieldLabel>
                <button type="button" onClick={() => updateWorkload({ ingressEnabled: false, ingressHost: '' })} className="hover:opacity-70" style={{ color: 'var(--text-3)' }}>
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-3)' }} />
                <TInput placeholder="app.example.com" value={w.ingressHost} onChange={(e) => updateWorkload({ ingressHost: e.target.value })} />
              </div>
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
        {w.env.length > 0 && (
          <div className="space-y-2">
            {w.env.map((env, i) => (
              <EnvVarRow key={i} envVar={env} index={i} onUpdate={updateEnv} onRemove={removeEnv} addonComponents={addonComponents} addonDefinitions={addonDefinitions} />
            ))}
          </div>
        )}
        {addonComponents.length > 0 && (
          <p className="text-[10.5px] mt-2" style={{ color: 'var(--text-4)' }}>
            Tip: click the link icon on a row to use a value exported by an addon component (e.g. <span className="font-mono">DATABASE_URL</span> from your postgres component).
          </p>
        )}
      </div>
    </ComponentCardShell>
  );
}

/* ---------- addon component card ---------- */

function AddonCard({
  component,
  onUpdate,
  onRemove,
  onToggleCollapse,
  addonDefinitions,
}: {
  component: ComponentEntry;
  onUpdate: (updated: ComponentEntry) => void;
  onRemove: () => void;
  onToggleCollapse: () => void;
  addonDefinitions: AddonDefinition[];
}) {
  const a = component.addon!;
  const def = addonDefinitions.find((d) => d.id === a.definitionId);
  const updateName = (name: string) => onUpdate({ ...component, name });
  const nameError = component.name.length > 0 && !k8sNameRegex.test(component.name);

  return (
    <ComponentCardShell
      collapsed={component.collapsed}
      onToggleCollapse={onToggleCollapse}
      onRemove={onRemove}
      iconBg="rgba(139,92,246,0.14)"
      icon={<Database className="h-3.5 w-3.5" style={{ color: '#8b5cf6' }} />}
      title={component.name || 'Unnamed addon'}
      subtitle={def?.name ?? a.addonType}
    >
      <div>
        <FieldLabel required>Component name</FieldLabel>
        <TInput placeholder="db" value={component.name} onChange={(e) => updateName(e.target.value)} />
        {nameError && <p className="text-[11px] mt-1" style={{ color: 'var(--err)' }}>Lowercase letters, numbers, and hyphens only</p>}
      </div>

      {def && (
        <div className="rounded-md p-3" style={{ background: 'var(--surface-2)' }}>
          <p className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{def.name}</p>
          {def.description && <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>{def.description}</p>}
          {def.chart_config && <p className="text-[10.5px] mt-1 font-mono" style={{ color: 'var(--text-4)' }}>{def.chart_config.name}:{def.chart_config.version}</p>}
        </div>
      )}

      {def?.export_schema && Object.keys(def.export_schema).length > 0 && (
        <div>
          <FieldLabel>Values this component exports to workloads</FieldLabel>
          <div className="flex flex-wrap gap-1">
            {Object.keys(def.export_schema).map((key) => (
              <span key={key} className="px-2 py-0.5 rounded text-[10.5px] font-mono" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{key}</span>
            ))}
          </div>
        </div>
      )}
    </ComponentCardShell>
  );
}

/* ---------- addon picker dialog ---------- */

function AddonPicker({
  definitions,
  onSelect,
  onClose,
}: {
  definitions: AddonDefinition[];
  onSelect: (def: AddonDefinition) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl border w-full max-w-lg mx-4 max-h-[70vh] flex flex-col anim-slide-up"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
      >
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Add an addon from the catalog</h3>
          <button type="button" onClick={onClose} className="hover:opacity-70" style={{ color: 'var(--text-3)' }}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {definitions.length === 0 ? (
            <p className="text-[12.5px] text-center py-8" style={{ color: 'var(--text-3)' }}>No addon definitions available in this cluster.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {definitions.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => onSelect(def)}
                  className="p-3.5 rounded-lg border text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-all"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0" style={{ background: 'rgba(139,92,246,0.14)' }}>{def.icon || '📦'}</span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>{def.name}</p>
                      <p className="text-[10.5px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-4)' }}>{def.description ?? def.type}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- add component button ---------- */

function AddComponentButton({ onAddWorkload, onAddAddon }: { onAddWorkload: () => void; onAddAddon: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed text-[12.5px] hover:opacity-80 w-full justify-center"
        style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
      >
        <Plus className="h-4 w-4" /> Add a component
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border overflow-hidden anim-slide-up" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}>
            <button type="button" onClick={() => { onAddWorkload(); setOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] text-left">
              <span className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}><Server className="h-4 w-4" style={{ color: 'var(--accent)' }} /></span>
              <div>
                <p className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>Workload</p>
                <p className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>Web service or background worker</p>
              </div>
            </button>
            <div style={{ borderTop: '1px solid var(--border)' }} />
            <button type="button" onClick={() => { onAddAddon(); setOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] text-left">
              <span className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.14)' }}><Database className="h-4 w-4" style={{ color: '#8b5cf6' }} /></span>
              <div>
                <p className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>Addon</p>
                <p className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>Database, cache, or message queue</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- from-template strip ---------- */

function TemplateStrip({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stack-templates', 'all'],
    queryFn: () => stackTemplatesApi.list(),
  });
  const templates = data?.data ?? [];
  if (isLoading || templates.length === 0) return null;

  const deployHref = (ns: string, name: string) => `/stacks/deploy?ns=${encodeURIComponent(ns)}&name=${encodeURIComponent(name)}${projectId ? `&project_id=${encodeURIComponent(projectId)}` : ''}`;

  return (
    <Card flush className="overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}><Layers className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} /> Start from a template</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Pick a pre-built stack, answer its parameters, and deploy in one click.</div>
        </div>
        <Link href="/settings/stack-templates" className="text-[12px] hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>Browse all →</Link>
      </div>
      <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {templates.slice(0, 6).map((t) => (
          <Link
            key={`${t.namespace}/${t.name}`}
            href={deployHref(t.namespace, t.name)}
            className="rounded-lg border p-3 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-all"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{t.icon || '📦'}</span>
              <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{t.name}</span>
              <span className="text-[10px] ml-auto font-mono" style={{ color: 'var(--text-4)' }}>v{t.version}</span>
            </div>
            {t.description && <p className="text-[10.5px] mt-1 line-clamp-2" style={{ color: 'var(--text-4)' }}>{t.description}</p>}
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ---------- main page ---------- */

let nextId = 1;
function genId() {
  return `comp-${nextId++}`;
}

export default function NewAppPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-[13px]" style={{ color: 'var(--text-3)' }}>Loading…</div>}>
      <NewAppPageInner />
    </Suspense>
  );
}

function NewAppPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const createApp = useCreateApp();

  const [appName, setAppName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(search.get('project_id') ?? '');
  const [components, setComponents] = useState<ComponentEntry[]>([]);
  const [deployed, setDeployed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddonPicker, setShowAddonPicker] = useState(false);

  const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: () => getAllProjects() });
  const projects = projectsData?.data ?? [];

  const { data: addonDefsData } = useQuery({
    queryKey: ['addon-definitions'],
    queryFn: () => addonDefinitionsApi.list({ items_per_page: 100 }),
  });
  const addonDefinitions = addonDefsData?.data ?? [];

  const addonComponents = useMemo(() => components.filter((c) => c.type === 'addon'), [components]);

  const addWorkload = useCallback(() => {
    setComponents((prev) => [
      ...prev,
      {
        id: genId(),
        name: '',
        type: 'workload',
        workload: { image: '', replicas: 1, port: 8080, ingressEnabled: false, ingressHost: '', env: [], kind: 'web-service' },
        collapsed: false,
      },
    ]);
  }, []);

  const addAddonFromDef = useCallback((def: AddonDefinition) => {
    setComponents((prev) => [
      ...prev,
      {
        id: genId(),
        name: def.slug,
        type: 'addon',
        addon: {
          definitionId: def.id,
          addonType: def.type,
          chart: def.chart_config ?? { repo: '', name: '', version: '' },
          values: (def.default_values as Record<string, unknown>) ?? {},
        },
        collapsed: false,
      },
    ]);
    setShowAddonPicker(false);
  }, []);

  const updateComponent = useCallback((id: string, updated: ComponentEntry) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);
  const removeComponent = useCallback((id: string) => setComponents((prev) => prev.filter((c) => c.id !== id)), []);
  const toggleCollapse = useCallback((id: string) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, collapsed: !c.collapsed } : c)));
  }, []);

  const buildDependsOn = (comp: ComponentEntry): string[] => {
    if (comp.type !== 'workload' || !comp.workload) return [];
    const deps = new Set<string>();
    for (const env of comp.workload.env) {
      if (env.export_ref?.component) deps.add(env.export_ref.component);
    }
    return Array.from(deps);
  };

  const handleDeploy = async () => {
    setError(null);

    if (!appName.trim()) return setError('App name is required');
    if (!k8sNameRegex.test(appName)) return setError('App name must be lowercase letters, numbers, and hyphens only');
    if (!selectedProjectId) return setError('Please select a project');
    if (components.length === 0) return setError('Add at least one component');

    const unnamed = components.find((c) => !c.name.trim());
    if (unnamed) return setError('All components must have a name');

    const badName = components.find((c) => !k8sNameRegex.test(c.name));
    if (badName) return setError(`Component "${badName.name}" has an invalid name. Use lowercase letters, numbers, and hyphens.`);

    const names = components.map((c) => c.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) return setError(`Duplicate component name: "${dupes[0]}"`);

    const noImage = components.find((c) => c.type === 'workload' && !c.workload?.image.trim());
    if (noImage) return setError(`Workload "${noImage.name}" needs a container image`);

    const appComponents: AppComponent[] = components.map((c) => {
      if (c.type === 'workload') {
        const w = c.workload!;
        const envVars: AppEnvVar[] = w.env
          .filter((e) => e.name.trim())
          .map((e) => (e.export_ref ? { name: e.name, export_ref: e.export_ref } : { name: e.name, value: e.value ?? '' }));
        return {
          name: c.name,
          type: 'workload' as const,
          depends_on: buildDependsOn(c),
          workload_spec: {
            image: w.image,
            replicas: w.replicas,
            port: w.kind === 'web-service' ? w.port : undefined,
            env: envVars.length > 0 ? envVars : undefined,
            ingress: w.kind === 'web-service' && w.ingressEnabled && w.ingressHost ? { enabled: true, host: w.ingressHost, path: '/' } : undefined,
          },
        };
      }
      const a = c.addon!;
      return {
        name: c.name,
        type: 'addon' as const,
        addon_spec: {
          type: a.addonType as AddonType,
          chart: a.chart,
          values: Object.keys(a.values).length > 0 ? a.values : undefined,
        },
      };
    });

    try {
      await createApp.mutateAsync({ name: appName, project_id: selectedProjectId, components: appComponents });
      setDeployed(true);
      setTimeout(() => router.push('/apps'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create app');
    }
  };

  if (deployed) {
    return (
      <div className="px-6 py-8 max-w-[640px] mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3 anim-slide-up">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--ok-soft)' }}>
            <Check className="h-7 w-7" style={{ color: 'var(--ok)' }} />
          </div>
          <h2 className="text-[20px] font-semibold" style={{ color: 'var(--text)' }}>App created</h2>
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
            <span className="font-mono" style={{ color: 'var(--text-2)' }}>{appName}</span> is deploying with {components.length} component{components.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>
    );
  }

  const appNameError = appName.length > 0 && !k8sNameRegex.test(appName);

  return (
    <div className="px-6 py-5 max-w-[760px] mx-auto space-y-4">
      <Link href="/apps" className="inline-flex items-center gap-1.5 text-[12.5px] hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>
        <ArrowLeft size={13} /> Apps
      </Link>

      <div>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Create an app</h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
          Define workloads and addons; they deploy together. Everything stays in product terms — images, env vars, replicas, domains — never raw Kubernetes resources.
        </p>
      </div>

      <TemplateStrip projectId={selectedProjectId} />

      <Card flush>
        <div className="px-5 py-4 grid sm:grid-cols-2 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <FieldLabel required>App name</FieldLabel>
            <TInput placeholder="my-app" value={appName} onChange={(e) => setAppName(e.target.value)} disabled={createApp.isPending} />
            <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-4)' }}>Lowercase letters, numbers, and hyphens only.</p>
            {appNameError && <p className="text-[11px] mt-1" style={{ color: 'var(--err)' }}>Lowercase letters, numbers, and hyphens only</p>}
          </div>
          <div>
            <FieldLabel required>Project</FieldLabel>
            <TSelect value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={createApp.isPending}>
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name || p.name} ({p.namespace})</option>
              ))}
            </TSelect>
            <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-4)' }}>Determines the target cluster.</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3">
            <SectionLabel>Components</SectionLabel>
            <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>Add at least one workload. Add addons (databases, caches) and wire their exported values into workload env vars.</p>
          </div>

          {components.length > 0 && (
            <div className="space-y-3 mb-3">
              {components.map((comp) =>
                comp.type === 'workload' ? (
                  <WorkloadCard
                    key={comp.id}
                    component={comp}
                    onUpdate={(updated) => updateComponent(comp.id, updated)}
                    onRemove={() => removeComponent(comp.id)}
                    onToggleCollapse={() => toggleCollapse(comp.id)}
                    addonComponents={addonComponents}
                    addonDefinitions={addonDefinitions}
                  />
                ) : (
                  <AddonCard
                    key={comp.id}
                    component={comp}
                    onUpdate={(updated) => updateComponent(comp.id, updated)}
                    onRemove={() => removeComponent(comp.id)}
                    onToggleCollapse={() => toggleCollapse(comp.id)}
                    addonDefinitions={addonDefinitions}
                  />
                ),
              )}
            </div>
          )}

          <AddComponentButton onAddWorkload={addWorkload} onAddAddon={() => setShowAddonPicker(true)} />
        </div>

        {error && (
          <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="rounded-lg p-3 text-[12.5px]" style={{ background: 'var(--err-soft)', color: 'var(--err)' }}>{error}</div>
          </div>
        )}

        <div className="px-5 py-4 flex gap-2 justify-end" style={{ borderTop: '1px solid var(--border)' }}>
          <Btn type="button" variant="ghost" size="sm" onClick={() => router.push('/apps')} disabled={createApp.isPending}>Cancel</Btn>
          <Btn type="button" variant="primary" size="sm" onClick={handleDeploy} disabled={createApp.isPending}>{createApp.isPending ? 'Deploying…' : 'Deploy'}</Btn>
        </div>
      </Card>

      {showAddonPicker && <AddonPicker definitions={addonDefinitions} onSelect={addAddonFromDef} onClose={() => setShowAddonPicker(false)} />}
    </div>
  );
}
