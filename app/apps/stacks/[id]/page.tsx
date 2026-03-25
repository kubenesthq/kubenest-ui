'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Trash2, Database, Container, Layers, Settings2,
  Terminal, BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  getDemoDeployedStack, deleteDemoDeployedStack,
  type DemoDeployedStack,
} from '@/lib/demo-store';

const statusColors: Record<string, string> = {
  running: 'bg-emerald-100 text-emerald-700',
  deploying: 'bg-blue-100 text-blue-700',
  degraded: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};
const statusDots: Record<string, string> = {
  running: 'bg-emerald-500',
  deploying: 'bg-blue-500',
  degraded: 'bg-amber-500',
  failed: 'bg-red-500',
};

type Tab = 'info' | 'logs' | 'metrics';

function generateLogs(name: string): string[] {
  const now = new Date();
  const messages = [
    `Deploying stack ${name}...`,
    'Provisioning application workload...',
    'Pulling container image...',
    'Image pulled successfully',
    'Creating managed addon instances...',
    'PostgreSQL provisioned (v16, 10Gi)',
    'Redis provisioned (v7, 256mb)',
    'Wiring environment variables...',
    'DATABASE_URL injected',
    'REDIS_URL injected',
    'Starting application pods...',
    'Pod 0/1 ready',
    'Pod 1/1 ready',
    'Health check passed',
    'Stack deployment complete',
    'GET /healthz 200 1ms',
    'GET /api/v1/status 200 4ms',
    'POST /api/v1/data 201 11ms',
    'GET /healthz 200 1ms',
    'Connection pool: 3/20 active',
  ];
  return messages.map((msg, i) => {
    const ts = new Date(now.getTime() - (messages.length - i) * 3000);
    return `${ts.toISOString().replace('T', ' ').slice(0, 19)}  ${msg}`;
  });
}

function generateMetricData(): { cpu: number[]; memory: number[]; labels: string[] } {
  const labels: string[] = [];
  const cpu: number[] = [];
  const memory: number[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60000);
    labels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    cpu.push(Math.round(12 + Math.random() * 30 + Math.sin(i / 4) * 8));
    memory.push(Math.round(180 + Math.random() * 60 + Math.cos(i / 6) * 25));
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
          <div key={i} className="flex-1 flex flex-col justify-end group relative">
            <div className={`${color} rounded-t-sm min-h-[2px] transition-all hover:opacity-80`} style={{ height: `${(val / max) * 100}%` }} />
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

export default function StackDetailPage() {
  const router = useRouter();
  const params = useParams();
  const stackId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>('info');

  const [stack, setStack] = useState<DemoDeployedStack | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => { setStack(getDemoDeployedStack(stackId)); }, [stackId]);

  const logs = useMemo(() => stack ? generateLogs(stack.name) : [], [stack?.name]);
  const metrics = useMemo(() => generateMetricData(), []);

  const handleDelete = () => {
    deleteDemoDeployedStack(stackId);
    router.push('/apps');
  };

  if (!stack) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <p className="text-zinc-500">Stack not found.</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Go back
        </Button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Container }[] = [
    { key: 'info', label: 'Info', icon: Layers },
    { key: 'logs', label: 'Logs', icon: Terminal },
    { key: 'metrics', label: 'Metrics', icon: BarChart3 },
  ];

  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2">
        <Link href="/apps"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Apps</Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{stack.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[stack.status] ?? ''}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusDots[stack.status] ?? ''}`} />
              {stack.status}
            </span>
            <Badge variant="secondary" className="text-xs font-normal bg-violet-100 text-violet-700">
              <Layers className="h-3 w-3 mr-1" /> Stack
            </Badge>
            <span className="text-xs text-zinc-400">Deployed {new Date(stack.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Stack
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
          <Card className="border-zinc-200">
            <CardHeader className="pb-3"><CardTitle className="text-base">Stack Template</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
                <div>
                  <p className="text-zinc-400 text-xs mb-0.5">Template</p>
                  <p className="text-zinc-900 font-medium">{stack.template_name}</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-xs mb-0.5">Workload</p>
                  <p className="font-mono text-zinc-900">{stack.workload_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200">
            <CardHeader className="pb-3"><CardTitle className="text-base">Components</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stack.image && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center bg-zinc-100 text-zinc-600 shrink-0"><Container className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">Application</p>
                      <p className="text-xs text-zinc-500 font-mono">{stack.image}</p>
                    </div>
                    <span className={`ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[stack.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDots[stack.status]}`} />{stack.status}
                    </span>
                  </div>
                )}
                {stack.addons.map((addon) => (
                  <div key={addon} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center bg-blue-100 text-blue-700 shrink-0"><Database className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{addon}</p>
                      <p className="text-xs text-zinc-500">Managed addon</p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />running
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {Object.keys(stack.variables).length > 0 && (
            <Card className="border-zinc-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-zinc-400" /> Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {Object.entries(stack.variables).map(([key, value]) => (
                    <div key={key} className="flex gap-2 font-mono text-xs">
                      <span className="text-zinc-600 min-w-[140px]">{key}</span>
                      <span className="text-zinc-300">=</span>
                      <span className="text-zinc-500">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Stack Logs</CardTitle>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
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
                <span className="text-sm text-zinc-400">/ 1000m limit</span>
              </div>
              <SimpleBarChart data={metrics.cpu} labels={metrics.labels} max={80} unit="m" color="bg-blue-500" />
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
                <span className="text-sm text-zinc-400">/ 1024Mi limit</span>
              </div>
              <SimpleBarChart data={metrics.memory} labels={metrics.labels} max={300} unit="Mi" color="bg-violet-500" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Stack</DialogTitle>
            <DialogDescription>Are you sure you want to delete <strong>{stack.name}</strong>? This will remove all components.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Stack</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
