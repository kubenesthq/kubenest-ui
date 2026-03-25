'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Database, Layers, Package,
  Container, GitBranch, Check, X, Terminal, BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  getDemoWorkload,
  attachAddonToWorkload,
  detachAddonFromWorkload,
  createStackTemplateFromWorkload,
  type DemoWorkload,
  type DemoStackVariable,
} from '@/lib/demo-store';

const AVAILABLE_ADDONS: Array<{
  type: string;
  name: string;
  icon: typeof Database;
  color: string;
  default_config: Record<string, string>;
  default_env: Record<string, string>;
}> = [
  { type: 'postgres', name: 'PostgreSQL', icon: Database, color: 'bg-blue-100 text-blue-700', default_config: { version: '16', storage: '10Gi' }, default_env: { DATABASE_URL: 'postgres://app:secret@postgres:5432/appdb' } },
  { type: 'redis', name: 'Redis', icon: Database, color: 'bg-red-100 text-red-700', default_config: { version: '7', maxmemory: '256mb' }, default_env: { REDIS_URL: 'redis://redis:6379/0' } },
  { type: 'mongodb', name: 'MongoDB', icon: Database, color: 'bg-green-100 text-green-700', default_config: { version: '7', storage: '10Gi' }, default_env: { MONGO_URL: 'mongodb://mongo:27017/appdb' } },
  { type: 'rabbitmq', name: 'RabbitMQ', icon: Package, color: 'bg-orange-100 text-orange-700', default_config: { version: '3.13', management: 'true' }, default_env: { AMQP_URL: 'amqp://guest:guest@rabbitmq:5672/' } },
  { type: 'kafka', name: 'Kafka', icon: Package, color: 'bg-purple-100 text-purple-700', default_config: { version: '3.7', partitions: '3' }, default_env: { KAFKA_BROKERS: 'kafka:9092' } },
  { type: 'mysql', name: 'MySQL', icon: Database, color: 'bg-cyan-100 text-cyan-700', default_config: { version: '8.4', storage: '10Gi' }, default_env: { DATABASE_URL: 'mysql://app:secret@mysql:3306/appdb' } },
];

type Tab = 'info' | 'logs' | 'metrics';

// Generate dummy log lines
function generateLogs(name: string): string[] {
  const now = new Date();
  const lines: string[] = [];
  const messages = [
    `Starting ${name}...`,
    'Connecting to database...',
    'Database connection established',
    'Loading configuration from environment',
    'Initializing HTTP server on :80',
    'Health check endpoint registered at /healthz',
    'Ready to accept connections',
    'GET /healthz 200 1ms',
    'GET /api/v1/status 200 3ms',
    'POST /api/v1/data 201 12ms',
    'GET /healthz 200 1ms',
    'GET /api/v1/users 200 8ms',
    'POST /api/v1/events 202 5ms',
    'GET /healthz 200 1ms',
    'Connection pool: 5/20 active',
    'GET /api/v1/metrics 200 2ms',
    'Periodic cleanup: removed 0 stale sessions',
    'GET /healthz 200 1ms',
    'GET /api/v1/status 200 2ms',
    'POST /api/v1/data 201 9ms',
  ];
  for (let i = 0; i < messages.length; i++) {
    const ts = new Date(now.getTime() - (messages.length - i) * 3000);
    const time = ts.toISOString().replace('T', ' ').slice(0, 19);
    lines.push(`${time}  ${messages[i]}`);
  }
  return lines;
}

// Generate dummy metric data points
function generateMetricData(): { cpu: number[]; memory: number[]; labels: string[] } {
  const labels: string[] = [];
  const cpu: number[] = [];
  const memory: number[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60000);
    labels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    cpu.push(Math.round(8 + Math.random() * 25 + Math.sin(i / 5) * 10));
    memory.push(Math.round(120 + Math.random() * 40 + Math.cos(i / 8) * 20));
  }
  return { cpu, memory, labels };
}

function SimpleBarChart({ data, labels, max, unit, color }: {
  data: number[]; labels: string[]; max: number; unit: string; color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-[2px] h-32">
        {data.map((val, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col justify-end group relative"
          >
            <div
              className={`${color} rounded-t-sm min-h-[2px] transition-all hover:opacity-80`}
              style={{ height: `${(val / max) * 100}%` }}
            />
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-zinc-900 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap z-10">
              {val}{unit}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{labels[0]}</span>
        <span>{labels[Math.floor(labels.length / 2)]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

export default function DemoWorkloadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workloadId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>('info');

  const [workload, setWorkload] = useState<DemoWorkload | null>(null);
  const [showAddonPicker, setShowAddonPicker] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);

  const reload = () => setWorkload(getDemoWorkload(workloadId));
  useEffect(() => { reload(); }, [workloadId]);

  const logs = useMemo(() => workload ? generateLogs(workload.name) : [], [workload?.name]);
  const metrics = useMemo(() => generateMetricData(), []);

  if (!workload) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <p className="text-zinc-500">Workload not found.</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Go back
        </Button>
      </div>
    );
  }

  const handleAttachAddon = (addonType: string) => {
    const addon = AVAILABLE_ADDONS.find(a => a.type === addonType);
    if (!addon) return;
    attachAddonToWorkload(workload.id, {
      addon_type: addon.type, addon_name: addon.name,
      config: addon.default_config, env_bindings: addon.default_env,
    });
    reload();
    setShowAddonPicker(false);
  };

  const handleDetachAddon = (addonId: string) => {
    detachAddonFromWorkload(workload.id, addonId);
    reload();
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const variables: DemoStackVariable[] = [];
    Object.entries(workload.env).forEach(([key, value]) => {
      variables.push({ key, label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), default_value: value, description: `Environment variable ${key}` });
    });
    workload.addons.forEach(addon => {
      Object.entries(addon.env_bindings).forEach(([key, value]) => {
        if (!variables.some(v => v.key === key)) {
          variables.push({ key, label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), default_value: value, description: `Provided by ${addon.addon_name}` });
        }
      });
    });
    createStackTemplateFromWorkload(workload, { name: templateName, description: templateDescription, variables });
    setTemplateSaved(true);
  };

  const attachedTypes = new Set(workload.addons.map(a => a.addon_type));
  const availableToAttach = AVAILABLE_ADDONS.filter(a => !attachedTypes.has(a.type));

  const tabs: { key: Tab; label: string; icon: typeof Container }[] = [
    { key: 'info', label: 'Info', icon: Container },
    { key: 'logs', label: 'Logs', icon: Terminal },
    { key: 'metrics', label: 'Metrics', icon: BarChart3 },
  ];

  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2">
        <Link href="/apps">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Apps
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{workload.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {workload.phase}
            </span>
            <span className="text-xs text-zinc-400">
              Created {new Date(workload.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSaveTemplate(true)} disabled={showSaveTemplate}>
          <Layers className="h-3.5 w-3.5 mr-1.5" />
          Save as Stack Template
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              activeTab === tab.key
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <>
          {/* Config Card */}
          <Card className="border-zinc-200">
            <CardHeader className="pb-3"><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
                <div>
                  <p className="text-zinc-400 text-xs mb-0.5">Source</p>
                  <div className="flex items-center gap-1.5 text-zinc-900 font-medium">
                    {workload.source_type === 'image' ? (
                      <><Container className="h-3.5 w-3.5 text-zinc-400" /> {workload.image}</>
                    ) : (
                      <><GitBranch className="h-3.5 w-3.5 text-zinc-400" /> {workload.git_repo}</>
                    )}
                  </div>
                </div>
                {workload.source_type === 'git' && (
                  <div>
                    <p className="text-zinc-400 text-xs mb-0.5">Branch</p>
                    <p className="font-mono text-zinc-900">{workload.git_branch}</p>
                  </div>
                )}
                <div>
                  <p className="text-zinc-400 text-xs mb-0.5">Replicas</p>
                  <p className="text-zinc-900 font-medium">{workload.replicas}</p>
                </div>
                {workload.port && (
                  <div>
                    <p className="text-zinc-400 text-xs mb-0.5">Port</p>
                    <p className="text-zinc-900 font-medium">{workload.port}</p>
                  </div>
                )}
              </div>
              {Object.keys(workload.env).length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <p className="text-zinc-400 text-xs mb-2">Environment Variables</p>
                  <div className="space-y-1">
                    {Object.entries(workload.env).map(([k, v]) => (
                      <div key={k} className="flex gap-2 font-mono text-xs">
                        <span className="text-zinc-600">{k}</span>
                        <span className="text-zinc-300">=</span>
                        <span className="text-zinc-500 truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Addons Card */}
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Addons</CardTitle>
                {availableToAttach.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setShowAddonPicker(!showAddonPicker)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Attach Addon
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {showAddonPicker && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 p-4 rounded-lg border border-zinc-200 bg-zinc-50">
                  <p className="text-sm font-medium text-zinc-700 mb-3">Select an addon to attach</p>
                  <div className="grid grid-cols-3 gap-2">
                    {availableToAttach.map(addon => {
                      const Icon = addon.icon;
                      return (
                        <button key={addon.type} onClick={() => handleAttachAddon(addon.type)} className="flex items-center gap-2 p-3 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 transition-all text-left">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${addon.color}`}><Icon className="h-4 w-4" /></div>
                          <span className="text-sm font-medium text-zinc-900">{addon.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAddonPicker(false)}>Cancel</Button>
                </motion.div>
              )}
              {workload.addons.length === 0 ? (
                <p className="text-sm text-zinc-400 py-2">No addons attached yet. Attach databases, caches, or message brokers.</p>
              ) : (
                <div className="space-y-3">
                  {workload.addons.map(addon => {
                    const addonMeta = AVAILABLE_ADDONS.find(a => a.type === addon.addon_type);
                    const Icon = addonMeta?.icon ?? Database;
                    return (
                      <div key={addon.id} className="flex items-start justify-between p-3 rounded-lg border border-zinc-200">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${addonMeta?.color ?? 'bg-zinc-100 text-zinc-600'}`}><Icon className="h-4 w-4" /></div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900">{addon.addon_name}</p>
                            <div className="flex gap-3 mt-1">
                              {Object.entries(addon.config).map(([k, v]) => (
                                <span key={k} className="text-xs text-zinc-500">{k}: <span className="font-mono">{v}</span></span>
                              ))}
                            </div>
                            <div className="mt-2 space-y-0.5">
                              {Object.entries(addon.env_bindings).map(([k, v]) => (
                                <div key={k} className="font-mono text-xs flex gap-1">
                                  <span className="text-emerald-600">{k}</span>
                                  <span className="text-zinc-300">=</span>
                                  <span className="text-zinc-400 truncate max-w-[300px]">{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => handleDetachAddon(addon.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save as Stack Template */}
          {showSaveTemplate && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-zinc-200 border-2 border-dashed">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Save as Stack Template</CardTitle>
                    {!templateSaved && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSaveTemplate(false)}><X className="h-4 w-4" /></Button>}
                  </div>
                  <CardDescription>Capture this workload + addons as a reusable template</CardDescription>
                </CardHeader>
                <CardContent>
                  {templateSaved ? (
                    <div className="text-center py-6 space-y-3">
                      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="h-6 w-6 text-emerald-600" /></div>
                      <p className="font-medium text-zinc-900">Template Saved</p>
                      <p className="text-sm text-zinc-500">&quot;{templateName}&quot; is now available in Stack Templates.</p>
                      <Button variant="outline" size="sm" onClick={() => router.push('/settings/stack-templates')}>
                        <Layers className="h-3.5 w-3.5 mr-1.5" /> View Stack Templates
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input id="templateName" placeholder="e.g. Node.js + PostgreSQL" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="templateDesc">Description</Label>
                        <Textarea id="templateDesc" placeholder="A production-ready Node.js app with PostgreSQL database" rows={2} value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} />
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-3 space-y-2">
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Template includes</p>
                        <div className="flex items-center gap-2 text-sm text-zinc-700">
                          <Container className="h-3.5 w-3.5 text-zinc-400" />
                          Workload: <span className="font-mono text-zinc-900">{workload.name}</span>
                          <span className="text-zinc-400">({workload.source_type === 'image' ? workload.image : workload.git_repo})</span>
                        </div>
                        {workload.addons.map(addon => (
                          <div key={addon.id} className="flex items-center gap-2 text-sm text-zinc-700">
                            <Database className="h-3.5 w-3.5 text-zinc-400" /> Addon: <span className="font-medium">{addon.addon_name}</span>
                          </div>
                        ))}
                        {Object.keys(workload.env).length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-zinc-700">
                            <Package className="h-3.5 w-3.5 text-zinc-400" /> {Object.keys(workload.env).length} environment variable(s)
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>Save Template</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Application Logs</CardTitle>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-zinc-950 rounded-lg p-4 font-mono text-xs text-zinc-300 max-h-[500px] overflow-y-auto space-y-0.5">
              {logs.map((line, i) => (
                <div key={i} className="hover:bg-zinc-900/50 px-1 -mx-1 rounded">
                  <span className="text-zinc-500">{line.slice(0, 19)}</span>
                  <span className="text-zinc-300">{line.slice(19)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">CPU Usage</CardTitle>
              <CardDescription>Millicores used over the last 30 minutes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-zinc-900">{metrics.cpu[metrics.cpu.length - 1]}m</span>
                <span className="text-sm text-zinc-400">/ 500m limit</span>
              </div>
              <SimpleBarChart data={metrics.cpu} labels={metrics.labels} max={60} unit="m" color="bg-blue-500" />
            </CardContent>
          </Card>

          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Memory Usage</CardTitle>
              <CardDescription>MiB used over the last 30 minutes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-zinc-900">{metrics.memory[metrics.memory.length - 1]}Mi</span>
                <span className="text-sm text-zinc-400">/ 512Mi limit</span>
              </div>
              <SimpleBarChart data={metrics.memory} labels={metrics.labels} max={200} unit="Mi" color="bg-violet-500" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
