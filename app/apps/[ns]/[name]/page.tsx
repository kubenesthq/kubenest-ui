'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Container,
  Database,
  Loader2,
  RefreshCw,
  RotateCw,
  Trash2,
  AlertCircle,
  Pause,
  Play,
  Download,
  Plus,
  X,
  KeyRound,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/react-query';
import { getProject } from '@/api/projects';
import { getCluster } from '@/api/clusters';
import {
  useApp,
  useAppDeployments,
  useDeleteApp,
  useRedeployApp,
  useRollbackApp,
  useSyncAppStatus,
  useComponentSecrets,
  useUpsertComponentSecrets,
  useDeleteComponentSecret,
} from '@/hooks/useApps';
import { appLogStreamUrl } from '@/lib/api/apps';
import type {
  AppPhase,
  AppReadComponent,
  ComponentStatus,
  DeploymentRecord,
} from '@/types/api';

const phaseColors: Record<string, string> = {
  Running: 'bg-emerald-100 text-emerald-700',
  Deploying: 'bg-blue-100 text-blue-700',
  Pending: 'bg-zinc-100 text-zinc-600',
  Degraded: 'bg-amber-100 text-amber-700',
  Failed: 'bg-red-100 text-red-700',
};
const phaseDots: Record<string, string> = {
  Running: 'bg-emerald-500',
  Deploying: 'bg-blue-500',
  Pending: 'bg-zinc-400',
  Degraded: 'bg-amber-500',
  Failed: 'bg-red-500',
};

function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        phaseColors[phase] ?? 'bg-zinc-100 text-zinc-600'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          phaseDots[phase] ?? 'bg-zinc-400'
        }`}
      />
      {phase}
    </span>
  );
}

export default function AppDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const namespace = params.ns as string;
  const name = params.name as string;
  const projectId = search.get('project_id') ?? '';

  const appQuery = useApp(namespace, name, projectId);
  const syncMutation = useSyncAppStatus(namespace, name, projectId);
  const redeploy = useRedeployApp(namespace, name, projectId);
  const deleteApp = useDeleteApp();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<ComponentStatus[] | null>(null);
  const [livePhase, setLivePhase] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });
  const { data: cluster } = useQuery({
    queryKey: ['cluster', project?.cluster_id],
    queryFn: () => getCluster(project!.cluster_id),
    enabled: !!project?.cluster_id,
  });

  // Auto-refresh status on first load + every 15s.
  useEffect(() => {
    if (!projectId || !namespace || !name) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await syncMutation.mutateAsync();
        if (!cancelled) {
          setLiveStatuses(res.components);
          setLivePhase(res.phase);
        }
      } catch {
        // surface inline; don't toast every 15s
      }
    };
    refresh();
    const id = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, name, projectId]);

  const handleRedeploy = () => {
    redeploy.mutate(undefined, {
      onSuccess: (res) => toast({ title: 'Redeploy triggered', description: res.message }),
      onError: (e: Error) =>
        toast({ title: 'Redeploy failed', description: e.message, variant: 'error' }),
    });
  };

  const handleDelete = () => {
    deleteApp.mutate(
      { namespace, name, projectId },
      {
        onSuccess: () => {
          toast({ title: 'App deleted' });
          router.push('/apps');
        },
        onError: (e: Error) =>
          toast({ title: 'Delete failed', description: e.message, variant: 'error' }),
      },
    );
  };

  if (!projectId) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-500">
            Missing project_id. Open this app from the Apps list.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (appQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (appQuery.isError || !appQuery.data) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-500">
            App not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const app = appQuery.data;
  const aggregatePhase: AppPhase = (livePhase as AppPhase | null) ?? app.phase;
  const components = app.components;
  const componentStatusByName: Record<string, ComponentStatus> = {};
  for (const s of liveStatuses ?? []) componentStatusByName[s.name] = s;

  return (
    <div className="px-8 py-8 max-w-6xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
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

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 truncate">
              {app.name}
            </h1>
            <PhaseBadge phase={aggregatePhase} />
          </div>
          <p className="text-sm text-zinc-500">
            {project?.name ?? namespace}
            {cluster && <> · {cluster.name}</>}
            {app.created_at && (
              <> · created {format(new Date(app.created_at), 'MMM d, yyyy')}</>
            )}
          </p>
          {app.message && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 inline-block">
              {app.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RotateCw
              className={`h-3.5 w-3.5 mr-1.5 ${syncMutation.isPending ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button size="sm" onClick={handleRedeploy} disabled={redeploy.isPending}>
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${redeploy.isPending ? 'animate-spin' : ''}`}
            />
            {redeploy.isPending ? 'Redeploying…' : 'Redeploy'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="components" className="w-full">
        <TabsList className="h-10">
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="mt-4">
          <ComponentsCard
            components={components}
            statuses={componentStatusByName}
          />
        </TabsContent>

        <TabsContent value="deployments" className="mt-4">
          <DeploymentsTab
            namespace={namespace}
            name={name}
            projectId={projectId}
          />
        </TabsContent>

        <TabsContent value="environment" className="mt-4">
          <EnvironmentTab
            namespace={namespace}
            name={name}
            projectId={projectId}
            components={components}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <LogsTab
            namespace={namespace}
            name={name}
            projectId={projectId}
            components={components}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete app</DialogTitle>
            <DialogDescription>
              Delete <strong>{app.name}</strong>? This tears down the StackDeploy
              and all its components in <code>{namespace}</code>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteApp.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteApp.isPending}
            >
              {deleteApp.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComponentIcon({ type }: { type: string }) {
  return type === 'addon' ? (
    <Database className="h-4 w-4 text-purple-500" />
  ) : (
    <Container className="h-4 w-4 text-blue-500" />
  );
}

function ComponentsCard({
  components,
  statuses,
}: {
  components: AppReadComponent[];
  statuses: Record<string, ComponentStatus>;
}) {
  if (components.length === 0) {
    return (
      <Card className="border-zinc-200">
        <CardContent className="py-12 text-center text-sm text-zinc-500">
          No components.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-zinc-200">
      <CardContent className="py-2">
        <div className="divide-y divide-zinc-100">
          {components.map((c) => {
            const live = statuses[c.name];
            const phase = live?.phase ?? '—';
            return (
              <div
                key={c.name}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ComponentIcon type={c.type} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-zinc-500 capitalize">{c.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {live?.health && (
                    <span className="text-xs text-zinc-500">
                      {live.health}
                      {live.sync ? ` · ${live.sync}` : ''}
                    </span>
                  )}
                  <PhaseBadge phase={phase} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DeploymentsTab({
  namespace,
  name,
  projectId,
}: {
  namespace: string;
  name: string;
  projectId: string;
}) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;
  const deployments = useAppDeployments(namespace, name, projectId, page, itemsPerPage);
  const rollback = useRollbackApp(namespace, name, projectId);

  if (deployments.isLoading) {
    return (
      <Card className="border-zinc-200">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const rows = deployments.data?.data ?? [];
  if (rows.length === 0) {
    return (
      <Card className="border-zinc-200">
        <CardContent className="py-12 text-center text-sm text-zinc-500">
          No deployments yet.
        </CardContent>
      </Card>
    );
  }

  const handleRollback = (d: DeploymentRecord) => {
    rollback.mutate(d.id, {
      onSuccess: () =>
        toast({ title: 'Rolled back', description: d.description }),
      onError: (e: Error) =>
        toast({ title: 'Rollback failed', description: e.message, variant: 'error' }),
    });
  };

  const totalPages = Math.max(
    1,
    Math.ceil((deployments.data?.total_count ?? 0) / itemsPerPage),
  );

  return (
    <Card className="border-zinc-200">
      <CardContent className="py-2">
        <div className="divide-y divide-zinc-100">
          {rows.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between py-3 gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {d.description}
                </p>
                <p className="text-xs text-zinc-500">
                  {format(new Date(d.created_at), 'MMM d, HH:mm')} · {d.status}
                  {d.error_message ? ` · ${d.error_message}` : ''}
                </p>
              </div>
              <div className="shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!d.prior_state || rollback.isPending}
                  onClick={() => handleRollback(d)}
                  title={
                    d.prior_state
                      ? 'Restore the spec captured by this deployment'
                      : 'No prior state captured — cannot rollback'
                  }
                >
                  Rollback
                </Button>
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 py-2 text-xs text-zinc-500">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EnvironmentTab({
  namespace,
  name,
  projectId,
  components,
}: {
  namespace: string;
  name: string;
  projectId: string;
  components: AppReadComponent[];
}) {
  const workloadComponents = useMemo(
    () => components.filter((c) => c.type === 'workload'),
    [components],
  );
  const [active, setActive] = useState(workloadComponents[0]?.name ?? '');

  if (workloadComponents.length === 0) {
    return (
      <Card className="border-zinc-200">
        <CardContent className="py-12 text-center text-sm text-zinc-500">
          No workload components — environment secrets unavailable.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {workloadComponents.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setActive(c.name)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active === c.name
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {active && (
        <ComponentSecretsCard
          namespace={namespace}
          name={name}
          projectId={projectId}
          component={active}
        />
      )}
    </div>
  );
}

function ComponentSecretsCard({
  namespace,
  name,
  projectId,
  component,
}: {
  namespace: string;
  name: string;
  projectId: string;
  component: string;
}) {
  const { toast } = useToast();
  const secretsQuery = useComponentSecrets(namespace, name, component, projectId);
  const upsert = useUpsertComponentSecrets(namespace, name, component, projectId);
  const remove = useDeleteComponentSecret(namespace, name, component, projectId);
  const [draft, setDraft] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' },
  ]);

  const addRow = () => setDraft((rows) => [...rows, { key: '', value: '' }]);
  const updateRow = (i: number, patch: Partial<{ key: string; value: string }>) =>
    setDraft((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) =>
    setDraft((rows) => rows.filter((_, idx) => idx !== i));

  const save = () => {
    const payload: Record<string, string> = {};
    for (const r of draft) {
      const key = r.key.trim();
      if (!key) continue;
      payload[key] = r.value;
    }
    if (Object.keys(payload).length === 0) {
      toast({ title: 'Nothing to save', variant: 'error' });
      return;
    }
    upsert.mutate(
      { secrets: payload },
      {
        onSuccess: () => {
          toast({
            title: 'Secrets saved',
            description: 'Run Redeploy to pick up the new values',
          });
          setDraft([{ key: '', value: '' }]);
        },
        onError: (e: Error) =>
          toast({ title: 'Save failed', description: e.message, variant: 'error' }),
      },
    );
  };

  const drop = (key: string) => {
    remove.mutate(key, {
      onError: (e: Error) =>
        toast({ title: 'Delete failed', description: e.message, variant: 'error' }),
    });
  };

  const existing = secretsQuery.data?.keys ?? [];

  return (
    <Card className="border-zinc-200">
      <CardContent className="py-4 space-y-5">
        <div>
          <p className="text-xs font-medium text-zinc-700 mb-2">
            Existing secret keys ({existing.length})
          </p>
          {secretsQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          ) : existing.length === 0 ? (
            <p className="text-xs text-zinc-400">No secrets set for this component.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {existing.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100 text-xs font-mono text-zinc-700"
                >
                  <KeyRound className="h-3 w-3 text-zinc-400" />
                  {k}
                  <button
                    type="button"
                    onClick={() => drop(k)}
                    className="text-zinc-400 hover:text-red-500"
                    aria-label={`Remove ${k}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-700">Add or update</p>
          {draft.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="KEY"
                value={r.key}
                onChange={(e) => updateRow(i, { key: e.target.value })}
                className="font-mono text-xs h-8 flex-1"
              />
              <Input
                placeholder="value"
                value={r.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                type="password"
                className="font-mono text-xs h-8 flex-1"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-300 hover:text-red-500"
                aria-label="Remove row"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addRow}
              className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add row
            </button>
            <Button size="sm" onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? 'Saving…' : 'Save secrets'}
            </Button>
          </div>
          <p className="text-[11px] text-zinc-400">
            Secrets become env vars on the next pod restart. Click Redeploy after saving.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LogsTab({
  namespace,
  name,
  projectId,
  components,
}: {
  namespace: string;
  name: string;
  projectId: string;
  components: AppReadComponent[];
}) {
  const workloadComponents = useMemo(
    () => components.filter((c) => c.type === 'workload'),
    [components],
  );
  const [active, setActive] = useState(workloadComponents[0]?.name ?? '');

  if (workloadComponents.length === 0) {
    return (
      <Card className="border-zinc-200">
        <CardContent className="py-12 text-center text-sm text-zinc-500">
          No workload components — logs unavailable.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {workloadComponents.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setActive(c.name)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active === c.name
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {active && (
        <LogStream
          namespace={namespace}
          name={name}
          projectId={projectId}
          component={active}
        />
      )}
    </div>
  );
}

interface LogLine {
  id: number;
  message: string;
}

function LogStream({
  namespace,
  name,
  projectId,
  component,
}: {
  namespace: string;
  name: string;
  projectId: string;
  component: string;
}) {
  const token = useAuthStore((s) => s.token);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const append = useCallback((message: string) => {
    counterRef.current += 1;
    const id = counterRef.current;
    setLines((prev) => {
      const next = [...prev, { id, message }];
      return next.length > 2000 ? next.slice(-2000) : next;
    });
  }, []);

  const connect = useCallback(async () => {
    if (!token) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setConnected(false);
    setLines([]);

    try {
      const res = await fetch(
        appLogStreamUrl(namespace, name, component, projectId, 200),
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
          credentials: 'include',
        },
      );
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body.detail || body.message || detail;
        } catch { /* not JSON */ }
        setError(detail);
        return;
      }
      if (!res.body) {
        setError('Streaming not supported');
        return;
      }
      setConnected(true);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';
        for (const line of parts) {
          if (!line.trim() || line.startsWith('event:') || line.startsWith(':')) continue;
          if (line.startsWith('data:')) {
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.type === 'connected' || parsed.event === 'connected') continue;
              if (parsed.type === 'heartbeat' || parsed.event === 'heartbeat') continue;
              if (parsed.type === 'closed' || parsed.event === 'closed') {
                setConnected(false);
                setError('Stream closed by server');
                return;
              }
              append(parsed.line ?? parsed.message ?? payload);
            } catch {
              append(payload);
            }
          }
        }
      }
      setConnected(false);
      setError('Stream ended');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setConnected(false);
      setError(e instanceof Error ? e.message : 'Connection failed');
    }
  }, [namespace, name, projectId, component, token, append]);

  useEffect(() => {
    connect();
    return () => abortRef.current?.abort();
  }, [connect]);

  useEffect(() => {
    if (follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, follow]);

  const downloadLogs = () => {
    const blob = new Blob([lines.map((l) => l.message).join('\n')], {
      type: 'text/plain',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-${component}-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="border-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
        <div className="text-xs">
          {connected ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Streaming
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-1.5 text-red-500">
              <AlertCircle className="h-3 w-3" />
              {error}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {error && (
            <Button variant="ghost" size="sm" onClick={connect} className="h-7 px-2 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFollow((f) => !f)}
            className="h-7 px-2 text-xs"
          >
            {follow ? (
              <>
                <Pause className="h-3 w-3 mr-1" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" /> Follow
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadLogs}
            disabled={lines.length === 0}
            className="h-7 px-2 text-xs"
          >
            <Download className="h-3 w-3 mr-1" /> Download
          </Button>
        </div>
      </div>
      <CardContent className="p-0">
        <div
          ref={scrollRef}
          className="h-[480px] overflow-auto bg-zinc-950 text-zinc-100 font-mono text-xs p-3 leading-relaxed"
        >
          {lines.length === 0 && !error ? (
            <p className="text-zinc-500">Waiting for log lines…</p>
          ) : (
            lines.map((l) => (
              <div key={l.id} className="whitespace-pre-wrap break-all">
                {l.message}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
