'use client';

import { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  Globe,
  Link2,
  Plus,
  Server,
  Cog,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAllProjects } from '@/api/projects';
import { addonDefinitionsApi } from '@/lib/api/addons';
import { useCreateApp } from '@/hooks/useApps';
import type {
  AddonDefinition,
  AppComponent,
  AppEnvVar,
  AppComponentType,
  ChartSpec,
} from '@/types/api';

/* ---------- animation ---------- */

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

/* ---------- reusable layout ---------- */

function FormRow({
  label,
  description,
  required,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[240px_1fr] gap-8 items-start py-5">
      <div className="pt-2">
        <p className="text-sm font-medium text-zinc-900">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </p>
        {description && (
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SectionDivider() {
  return <div className="border-t border-zinc-100" />;
}

/* ---------- component name validation ---------- */

const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/* ---------- types for form buffer ---------- */

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

/* ---------- env var row ---------- */

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

  const brokenRef =
    isLinked && !addonComponents.some((c) => c.name === envVar.export_ref!.component);

  return (
    <div className="flex items-start gap-2 group">
      <div className="flex-1 min-w-0">
        <Input
          placeholder="KEY"
          value={envVar.name}
          onChange={(e) => onUpdate(index, { ...envVar, name: e.target.value })}
          className="font-mono text-xs h-8"
        />
      </div>
      <div className="flex-1 min-w-0 relative">
        {isLinked ? (
          <div
            className={`h-8 px-3 rounded-md border text-xs flex items-center gap-1.5 ${
              brokenRef
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}
          >
            {brokenRef ? (
              <AlertTriangle className="h-3 w-3 shrink-0" />
            ) : (
              <Link2 className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">
              {envVar.export_ref!.component}.{envVar.export_ref!.export_key}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdate(index, {
                  name: envVar.name,
                  value: '',
                  export_ref: undefined,
                })
              }
              className="ml-auto shrink-0 hover:text-blue-900"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Input
            placeholder="value"
            value={envVar.value ?? ''}
            onChange={(e) =>
              onUpdate(index, { ...envVar, value: e.target.value })
            }
            className="font-mono text-xs h-8"
          />
        )}
      </div>

      {/* Link to component button */}
      {!isLinked && addonComponents.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportPicker(!showExportPicker)}
            className="h-8 w-8 rounded-md border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 transition-colors"
            title="Link to component"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>

          {/* Export picker dropdown */}
          {showExportPicker && (
            <div className="absolute right-0 top-9 z-20 w-72 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 max-h-64 overflow-y-auto">
              <p className="px-3 py-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Link to component export
              </p>
              {addonComponents.map((comp) => {
                const def = addonDefinitions.find(
                  (d) => d.id === comp.addon?.definitionId
                );
                const exports = def?.export_schema;
                if (!exports || Object.keys(exports).length === 0) return null;
                return (
                  <div key={comp.id}>
                    <p className="px-3 py-1 text-xs font-medium text-zinc-700 bg-zinc-50">
                      {comp.name}{' '}
                      <span className="text-zinc-400">({def?.name})</span>
                    </p>
                    {Object.entries(exports).map(([key, schema]) => (
                      <button
                        key={key}
                        type="button"
                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 flex items-center justify-between"
                        onClick={() => {
                          onUpdate(index, {
                            name: envVar.name || key,
                            export_ref: {
                              component: comp.name,
                              export_key: key,
                            },
                          });
                          setShowExportPicker(false);
                        }}
                      >
                        <span className="font-mono">{key}</span>
                        <span className="text-zinc-400 truncate ml-2">
                          {schema.description}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ---------- workload component card ---------- */

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

  const updateWorkload = (patch: Partial<WorkloadFormData>) => {
    onUpdate({ ...component, workload: { ...w, ...patch } });
  };

  const updateName = (name: string) => {
    onUpdate({ ...component, name });
  };

  const updateEnv = (index: number, env: AppEnvVar) => {
    const next = [...w.env];
    next[index] = env;
    updateWorkload({ env: next });
  };

  const removeEnv = (index: number) => {
    updateWorkload({ env: w.env.filter((_, i) => i !== index) });
  };

  const addEnv = () => {
    updateWorkload({ env: [...w.env, { name: '', value: '' }] });
  };

  const nameError =
    component.name.length > 0 && !k8sNameRegex.test(component.name);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-100">
        <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center">
          {w.kind === 'web-service' ? (
            <Globe className="h-3.5 w-3.5 text-blue-600" />
          ) : (
            <Cog className="h-3.5 w-3.5 text-blue-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900">
            {component.name || 'Unnamed workload'}
          </p>
          <p className="text-[11px] text-zinc-400">
            {w.kind === 'web-service' ? 'Web Service' : 'Worker'}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          {component.collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-300 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <AnimatePresence>
        {!component.collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">
                  Component Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="api"
                  value={component.name}
                  onChange={(e) => updateName(e.target.value)}
                  className="text-sm h-8"
                />
                {nameError && (
                  <p className="text-xs text-destructive mt-1">
                    Lowercase letters, numbers, and hyphens only
                  </p>
                )}
              </div>

              {/* Kind toggle */}
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">
                  Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateWorkload({ kind: 'web-service', port: w.port ?? 8080 })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      w.kind === 'web-service'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    Web Service
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateWorkload({
                        kind: 'worker',
                        port: null,
                        ingressEnabled: false,
                        ingressHost: '',
                      })
                    }
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      w.kind === 'worker'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    Worker
                  </button>
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">
                  Image <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="myapp:latest"
                  value={w.image}
                  onChange={(e) => updateWorkload({ image: e.target.value })}
                  className="text-sm h-8"
                />
              </div>

              {/* Port + Replicas row */}
              <div className="flex gap-4">
                {w.kind === 'web-service' && (
                  <div className="w-24">
                    <label className="text-xs font-medium text-zinc-600 mb-1 block">
                      Port
                    </label>
                    <Input
                      type="number"
                      placeholder="8080"
                      value={w.port ?? ''}
                      onChange={(e) =>
                        updateWorkload({
                          port: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="text-sm h-8"
                    />
                  </div>
                )}
                <div className="w-24">
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">
                    Replicas
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={w.replicas}
                    onChange={(e) =>
                      updateWorkload({ replicas: Number(e.target.value) || 1 })
                    }
                    className="text-sm h-8"
                  />
                </div>
              </div>

              {/* Ingress (web service only) */}
              {w.kind === 'web-service' && (
                <div>
                  {!w.ingressEnabled ? (
                    <button
                      type="button"
                      onClick={() => updateWorkload({ ingressEnabled: true })}
                      className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add custom domain
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-zinc-600">
                          Domain
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkload({
                              ingressEnabled: false,
                              ingressHost: '',
                            })
                          }
                          className="text-zinc-400 hover:text-zinc-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <Input
                          placeholder="app.example.com"
                          value={w.ingressHost}
                          onChange={(e) =>
                            updateWorkload({ ingressHost: e.target.value })
                          }
                          className="text-sm h-8"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Environment Variables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-600">
                    Environment Variables
                  </label>
                  <button
                    type="button"
                    onClick={addEnv}
                    className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
                {w.env.length > 0 && (
                  <div className="space-y-2">
                    {w.env.map((env, i) => (
                      <EnvVarRow
                        key={i}
                        envVar={env}
                        index={i}
                        onUpdate={updateEnv}
                        onRemove={removeEnv}
                        addonComponents={addonComponents}
                        addonDefinitions={addonDefinitions}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

  const updateName = (name: string) => {
    onUpdate({ ...component, name });
  };

  const nameError =
    component.name.length > 0 && !k8sNameRegex.test(component.name);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-100">
        <div className="w-7 h-7 rounded-md bg-purple-100 flex items-center justify-center">
          <Database className="h-3.5 w-3.5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900">
            {component.name || 'Unnamed addon'}
          </p>
          <p className="text-[11px] text-zinc-400">
            {def?.name ?? a.addonType}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          {component.collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-300 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <AnimatePresence>
        {!component.collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">
                  Component Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="cache"
                  value={component.name}
                  onChange={(e) => updateName(e.target.value)}
                  className="text-sm h-8"
                />
                {nameError && (
                  <p className="text-xs text-destructive mt-1">
                    Lowercase letters, numbers, and hyphens only
                  </p>
                )}
              </div>

              {/* Info */}
              {def && (
                <div className="rounded-md bg-zinc-50 p-3">
                  <p className="text-xs font-medium text-zinc-700">
                    {def.name}
                  </p>
                  {def.description && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {def.description}
                    </p>
                  )}
                  {def.chart_config && (
                    <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                      {def.chart_config.name}:{def.chart_config.version}
                    </p>
                  )}
                </div>
              )}

              {/* Export schema preview */}
              {def?.export_schema &&
                Object.keys(def.export_schema).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-zinc-600 mb-1">
                      Exports available to workloads
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(def.export_schema).map((key) => (
                        <span
                          key={key}
                          className="px-2 py-0.5 rounded bg-zinc-100 text-[11px] font-mono text-zinc-600"
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-lg mx-4 max-h-[70vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">
            Add Addon from Catalog
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {definitions.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">
              No addon definitions available
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {definitions.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => onSelect(def)}
                  className="p-4 rounded-lg border border-zinc-200 text-left hover:border-zinc-400 hover:bg-zinc-50 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center text-lg shrink-0">
                      {def.icon || '📦'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 group-hover:text-zinc-700">
                        {def.name}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                        {def.description ?? def.type}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- add component button ---------- */

function AddComponentButton({
  onAddWorkload,
  onAddAddon,
}: {
  onAddWorkload: () => void;
  onAddAddon: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-zinc-200 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        Add Component
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white rounded-lg border border-zinc-200 shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                onAddWorkload();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
                <Server className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Workload</p>
                <p className="text-[11px] text-zinc-400">
                  Web service or background worker
                </p>
              </div>
            </button>
            <div className="border-t border-zinc-100" />
            <button
              type="button"
              onClick={() => {
                onAddAddon();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center">
                <Database className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Addon</p>
                <p className="text-[11px] text-zinc-400">
                  Database, cache, or message queue
                </p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- main page ---------- */

let nextId = 1;
function genId() {
  return `comp-${nextId++}`;
}

export default function NewAppPage() {
  return (
    <Suspense fallback={<div className="px-8 py-8 text-sm text-zinc-500">Loading…</div>}>
      <NewAppPageInner />
    </Suspense>
  );
}

function NewAppPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const createApp = useCreateApp();

  const [appName, setAppName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(
    search.get('project_id') ?? '',
  );
  const [components, setComponents] = useState<ComponentEntry[]>([]);
  const [deployed, setDeployed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddonPicker, setShowAddonPicker] = useState(false);

  /* data fetching */
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getAllProjects(),
  });
  const projects = projectsData?.data ?? [];

  // Preselect project from query param once projects load.
  useEffect(() => {
    const fromUrl = search.get('project_id');
    if (!fromUrl || selectedProjectId) return;
    if (projects.some((p) => p.id === fromUrl)) setSelectedProjectId(fromUrl);
  }, [projects, search, selectedProjectId]);

  const { data: addonDefsData } = useQuery({
    queryKey: ['addon-definitions'],
    queryFn: () => addonDefinitionsApi.list({ items_per_page: 100 }),
  });
  const addonDefinitions = addonDefsData?.data ?? [];

  /* derived */
  const addonComponents = useMemo(
    () => components.filter((c) => c.type === 'addon'),
    [components]
  );

  /* component CRUD */
  const addWorkload = useCallback(() => {
    setComponents((prev) => [
      ...prev,
      {
        id: genId(),
        name: '',
        type: 'workload',
        workload: {
          image: '',
          replicas: 1,
          port: 8080,
          ingressEnabled: false,
          ingressHost: '',
          env: [],
          kind: 'web-service',
        },
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

  const updateComponent = useCallback(
    (id: string, updated: ComponentEntry) => {
      setComponents((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
    },
    []
  );

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, collapsed: !c.collapsed } : c
      )
    );
  }, []);

  /* build depends_on from export_refs */
  const buildDependsOn = (comp: ComponentEntry): string[] => {
    if (comp.type !== 'workload' || !comp.workload) return [];
    const deps = new Set<string>();
    for (const env of comp.workload.env) {
      if (env.export_ref?.component) {
        deps.add(env.export_ref.component);
      }
    }
    return Array.from(deps);
  };

  /* submit */
  const handleDeploy = async () => {
    setError(null);

    // validation
    if (!appName.trim()) {
      setError('App name is required');
      return;
    }
    if (!k8sNameRegex.test(appName)) {
      setError(
        'App name must be lowercase letters, numbers, and hyphens only'
      );
      return;
    }
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }
    if (components.length === 0) {
      setError('Add at least one component');
      return;
    }

    // check all components have names
    const unnamed = components.find((c) => !c.name.trim());
    if (unnamed) {
      setError('All components must have a name');
      return;
    }

    // check name validity
    const badName = components.find(
      (c) => !k8sNameRegex.test(c.name)
    );
    if (badName) {
      setError(
        `Component "${badName.name}" has an invalid name. Use lowercase letters, numbers, and hyphens.`
      );
      return;
    }

    // check duplicate names
    const names = components.map((c) => c.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      setError(`Duplicate component name: "${dupes[0]}"`);
      return;
    }

    // check workloads have images
    const noImage = components.find(
      (c) => c.type === 'workload' && !c.workload?.image.trim()
    );
    if (noImage) {
      setError(`Workload "${noImage.name}" needs a container image`);
      return;
    }

    // build payload
    const appComponents: AppComponent[] = components.map((c) => {
      if (c.type === 'workload') {
        const w = c.workload!;
        const envVars: AppEnvVar[] = w.env
          .filter((e) => e.name.trim())
          .map((e) =>
            e.export_ref
              ? { name: e.name, export_ref: e.export_ref }
              : { name: e.name, value: e.value ?? '' }
          );

        return {
          name: c.name,
          type: 'workload' as const,
          depends_on: buildDependsOn(c),
          workload_spec: {
            image: w.image,
            replicas: w.replicas,
            port: w.kind === 'web-service' ? w.port : undefined,
            env: envVars.length > 0 ? envVars : undefined,
            ingress:
              w.kind === 'web-service' && w.ingressEnabled && w.ingressHost
                ? {
                    enabled: true,
                    host: w.ingressHost,
                    path: '/',
                  }
                : undefined,
          },
        };
      } else {
        const a = c.addon!;
        return {
          name: c.name,
          type: 'addon' as const,
          addon_spec: {
            type: a.addonType as any,
            chart: a.chart,
            values:
              Object.keys(a.values).length > 0 ? a.values : undefined,
          },
        };
      }
    });

    try {
      await createApp.mutateAsync({
        name: appName,
        project_id: selectedProjectId,
        components: appComponents,
      });
      setDeployed(true);
      setTimeout(() => {
        router.push('/apps');
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create app'
      );
    }
  };

  /* success state */
  if (deployed) {
    return (
      <div className="px-8 py-8 max-w-3xl mx-auto flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: easeOutQuart }}
          className="text-center space-y-4"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">App Deployed</h2>
          <p className="text-zinc-500">
            <span className="font-mono text-zinc-700">{appName}</span> is being
            deployed with {components.length} component
            {components.length !== 1 ? 's' : ''}.
          </p>
        </motion.div>
      </div>
    );
  }

  const appNameError = appName.length > 0 && !k8sNameRegex.test(appName);

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: easeOutQuart }}
      >
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2"
        >
          <Link href="/apps">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Apps
          </Link>
        </Button>
      </motion.div>

      {/* Header */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Create App
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Define your app with workloads and addons. Everything deploys together.
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
      >
        <div className="rounded-lg border border-zinc-200 bg-white">
          {/* App Name */}
          <div className="px-6">
            <FormRow
              label="App Name"
              description="A unique name for your app. Lowercase letters, numbers, and hyphens only."
              required
            >
              <Input
                placeholder="my-app"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                disabled={createApp.isPending}
              />
              {appNameError && (
                <p className="text-sm text-destructive mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              )}
            </FormRow>
          </div>

          <SectionDivider />

          {/* Project selector */}
          <div className="px-6">
            <FormRow
              label="Project"
              description="The project this app belongs to. Determines the cluster and namespace."
              required
            >
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={createApp.isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.name} ({p.namespace})
                  </option>
                ))}
              </select>
            </FormRow>
          </div>

          <SectionDivider />

          {/* Components */}
          <div className="px-6 py-5">
            <div className="mb-4">
              <p className="text-sm font-medium text-zinc-900">Components</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Add workloads (web services, workers) and addons (databases,
                caches) that make up your app.
              </p>
            </div>

            {components.length > 0 && (
              <div className="space-y-3 mb-4">
                {components.map((comp) =>
                  comp.type === 'workload' ? (
                    <WorkloadCard
                      key={comp.id}
                      component={comp}
                      onUpdate={(updated) =>
                        updateComponent(comp.id, updated)
                      }
                      onRemove={() => removeComponent(comp.id)}
                      onToggleCollapse={() => toggleCollapse(comp.id)}
                      addonComponents={addonComponents}
                      addonDefinitions={addonDefinitions}
                    />
                  ) : (
                    <AddonCard
                      key={comp.id}
                      component={comp}
                      onUpdate={(updated) =>
                        updateComponent(comp.id, updated)
                      }
                      onRemove={() => removeComponent(comp.id)}
                      onToggleCollapse={() => toggleCollapse(comp.id)}
                      addonDefinitions={addonDefinitions}
                    />
                  )
                )}
              </div>
            )}

            <AddComponentButton
              onAddWorkload={addWorkload}
              onAddAddon={() => setShowAddonPicker(true)}
            />
          </div>

          {/* Error */}
          {error && (
            <>
              <SectionDivider />
              <div className="px-6 py-4">
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <SectionDivider />
          <div className="px-6 py-4 flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/apps')}
              disabled={createApp.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeploy}
              disabled={createApp.isPending}
            >
              {createApp.isPending ? 'Deploying...' : 'Deploy'}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Addon picker modal */}
      <AnimatePresence>
        {showAddonPicker && (
          <AddonPicker
            definitions={addonDefinitions}
            onSelect={addAddonFromDef}
            onClose={() => setShowAddonPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
