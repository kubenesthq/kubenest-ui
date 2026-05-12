'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Loader2,
  RefreshCw,
  Server,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getCluster } from '@/api/clusters';
import { getProvisioningJobLogs, getProvisioningJobs, retryProvisioningJob } from '@/api/provisioning';
import { clustersApi } from '@/lib/api/clusters';
import type { Cluster, ProvisioningJob } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const POLL_MS = 5000;
const BOOTSTRAP_GRACE_MS = 4 * 60_000; // "installing k3s + operator" window before we say "waiting for the operator"
const REGISTER_TIMEOUT_MS = 12 * 60_000; // operator hasn't phoned home this long after Terraform finished -> named terminal state

const ANSI_RE = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[A-Za-z]', 'g');
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

type Phase =
  | 'awaiting_job'
  | 'queued'
  | 'provisioning'
  | 'provision_failed'
  | 'bootstrapping'
  | 'operator_registering'
  | 'operator_registration_failed'
  | 'cluster_ready';

const STAGE_LABELS = [
  'Queued',
  'Provisioning infrastructure',
  'Bootstrapping the cluster',
  'Operator registering',
  'Cluster ready',
] as const;

function computePhase(cluster: Cluster | undefined, job: ProvisioningJob | undefined, now: number): Phase {
  if (cluster?.status === 'connected') return 'cluster_ready';
  if (!job) return 'awaiting_job';
  if (job.status === 'PENDING') return 'queued';
  if (job.status === 'RUNNING') return 'provisioning';
  if (job.status === 'FAILED') return 'provision_failed';
  // job SUCCEEDED but the cluster hasn't connected yet -> post-provision bootstrap / registration.
  const completedAt = job.completed_at ? new Date(job.completed_at).getTime() : now;
  const elapsed = now - completedAt;
  if (cluster?.status === 'error' || elapsed >= REGISTER_TIMEOUT_MS) return 'operator_registration_failed';
  if (elapsed < BOOTSTRAP_GRACE_MS) return 'bootstrapping';
  return 'operator_registering';
}

// (currentStageIndex, failedAtCurrent) for the vertical timeline.
function phaseStage(phase: Phase): [number, boolean] {
  switch (phase) {
    case 'awaiting_job':
    case 'queued':
      return [0, false];
    case 'provisioning':
      return [1, false];
    case 'provision_failed':
      return [1, true];
    case 'bootstrapping':
      return [2, false];
    case 'operator_registering':
      return [3, false];
    case 'operator_registration_failed':
      return [3, true];
    case 'cluster_ready':
      return [4, false];
  }
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function useCopy(): { copied: boolean; copy: (t: string) => void } {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async (t: string) => {
      try {
        await navigator.clipboard.writeText(t);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* clipboard blocked — the text is still visible to select manually */
      }
    },
  };
}

function StageRow({ label, state }: { label: string; state: 'pending' | 'active' | 'done' | 'failed' }) {
  return (
    <div className="flex items-center gap-3" data-testid={`stage-${state === 'failed' ? 'failed' : state}`} data-stage-label={label}>
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {state === 'done' ? (
          <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="h-3 w-3 text-emerald-600" /></div>
        ) : state === 'failed' ? (
          <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center"><AlertCircle className="h-3 w-3 text-red-500" /></div>
        ) : state === 'active' ? (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-zinc-200" />
        )}
      </div>
      <span className={`text-sm ${state === 'done' ? 'text-zinc-500' : state === 'pending' ? 'text-zinc-300' : 'text-zinc-900 font-medium'}`}>{label}</span>
    </div>
  );
}

function LogsPanel({ jobId, running }: { jobId: string; running: boolean }) {
  const [open, setOpen] = useState(false);
  const logsQ = useQuery({
    queryKey: ['provisioning-job-logs', jobId],
    queryFn: () => getProvisioningJobLogs(jobId),
    enabled: open,
    refetchInterval: open && running ? 5000 : false,
  });
  const logs = logsQ.data ? stripAnsi(logsQ.data) : null;
  return (
    <div className="rounded-md border border-zinc-200">
      <button className="flex items-center justify-between w-full text-left px-4 py-3" onClick={() => setOpen((v) => !v)} data-testid="provisioning-logs-toggle">
        <span className="text-sm font-medium text-zinc-700 flex items-center gap-2"><Terminal className="h-4 w-4 text-zinc-400" /> Provisioning logs</span>
        <span className="flex items-center gap-2">{logsQ.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}{open ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {logsQ.isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-zinc-400" /></div>
          ) : logs ? (
            <pre className="bg-zinc-950 rounded-md p-4 max-h-[28rem] overflow-auto text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words leading-relaxed">{logs}</pre>
          ) : (
            <p className="text-xs text-zinc-400 py-4 text-center">No logs available for this job yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProvisioningStatusView({ clusterId }: { clusterId: string }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), POLL_MS);
    return () => clearInterval(t);
  }, []);

  const clusterQ = useQuery({
    queryKey: ['clusters', clusterId],
    queryFn: () => getCluster(clusterId),
    refetchInterval: (q) => ((q.state.data as Cluster | undefined)?.status === 'connected' ? false : POLL_MS),
  });
  const jobsQ = useQuery({
    queryKey: ['provisioning-jobs', clusterId],
    queryFn: () => getProvisioningJobs(clusterId),
    refetchInterval: clusterQ.data?.status === 'connected' ? false : POLL_MS,
  });
  const cluster = clusterQ.data;
  const job = useMemo(() => {
    const list = jobsQ.data ?? [];
    return list.find((j) => j.action === 'CREATE') ?? list[0];
  }, [jobsQ.data]);

  const phase = computePhase(cluster, job, now);
  const [curStage, failedAtCur] = phaseStage(phase);
  const isPostProvisionFail = phase === 'operator_registration_failed';

  const installQ = useQuery({
    queryKey: ['cluster-install-command', clusterId],
    queryFn: () => clustersApi.getInstallCommand(clusterId),
    enabled: phase === 'operator_registering' || isPostProvisionFail,
  });

  const retry = useMutation({
    mutationFn: () => retryProvisioningJob(job!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provisioning-jobs', clusterId] });
      queryClient.invalidateQueries({ queryKey: ['clusters', clusterId] });
    },
  });

  const copyDiag = useCopy();
  const diagnostic = useMemo(() => {
    const lines: (string | null)[] = [
      'KubeNest — operator registration diagnostic',
      `generated:        ${new Date(now).toISOString()}`,
      `cluster:          ${cluster?.name ?? '?'} (${clusterId})`,
      `cluster status:   ${cluster?.status ?? '?'}`,
      job ? `provision job:    ${job.id} — ${job.status}${job.completed_at ? ` (completed ${job.completed_at})` : ''}` : 'provision job:    none',
      job?.error_message ? `provision error:  ${job.error_message}` : null,
      installQ.data ? `hub url:          ${installQ.data.hub_url}` : null,
      installQ.data ? `operator install command:\n${installQ.data.command}` : null,
    ];
    return lines.filter((l): l is string => l != null).join('\n');
  }, [now, cluster, clusterId, job, installQ.data]);

  if (clusterQ.isLoading) {
    return <div className="px-8 py-16 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>;
  }
  if (!cluster) {
    return (
      <div className="px-8 py-8 max-w-3xl space-y-4">
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">Failed to load cluster{clusterQ.error instanceof Error ? `: ${clusterQ.error.message}` : ''}.</div>
        <Button variant="outline" size="sm" asChild><Link href="/clusters">Back to clusters</Link></Button>
      </div>
    );
  }

  const provisionStarted = job?.started_at ? new Date(job.started_at).getTime() : null;
  const provisionEnded = job?.completed_at ? new Date(job.completed_at).getTime() : (provisionStarted != null && (job?.status === 'RUNNING' || job?.status === 'PENDING') ? now : null);
  const provisionElapsed = provisionStarted != null && provisionEnded != null ? fmtElapsed(provisionEnded - provisionStarted) : null;

  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2">
          <Link href={`/clusters/${clusterId}`}><ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Cluster</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Provisioning {cluster.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {phase === 'cluster_ready'
            ? 'The cluster is provisioned, bootstrapped, and connected to KubeNest.'
            : phase === 'provision_failed'
              ? 'Infrastructure provisioning failed — review the error and retry.'
              : phase === 'operator_registration_failed'
                ? "Infrastructure is up, but the operator hasn't registered with KubeNest yet."
                : 'KubeNest is provisioning and bootstrapping the cluster. No SSH or kubeconfig handling is required.'}
        </p>
      </div>

      {/* Stage timeline */}
      <Card className="border-zinc-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Lifecycle</CardTitle>
            {job && (
              <Badge variant="outline" className={
                phase === 'cluster_ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : phase === 'provision_failed' || phase === 'operator_registration_failed' ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
              }>{phase.replace(/_/g, ' ')}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {STAGE_LABELS.map((label, i) => {
              const state: 'pending' | 'active' | 'done' | 'failed' =
                i < curStage ? 'done'
                : i > curStage ? 'pending'
                : failedAtCur ? 'failed'
                : phase === 'cluster_ready' ? 'done'
                : 'active';
              return <StageRow key={label} label={label} state={state} />;
            })}
          </div>

          {/* Per-stage detail — never a bare spinner. */}
          <div className="rounded-md bg-zinc-50 border border-zinc-100 px-4 py-3 text-sm text-zinc-600">
            {phase === 'awaiting_job' && (
              <p>Creating the provisioning job… If this persists, the cluster may have been registered manually rather than provisioned — <Link href={`/clusters/${clusterId}`} className="underline">open the cluster</Link>.</p>
            )}
            {phase === 'queued' && <p>Queued — waiting for a provisioner slot. The Terraform run starts momentarily.</p>}
            {phase === 'provisioning' && (
              <div className="space-y-2">
                <p>Terraform is creating VMs, networking, and disks for <span className="font-medium">{cluster.name}</span>. This typically takes 5–10 minutes.</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-zinc-500"><span>{job ? `${Math.round(job.progress_pct)}%` : ''}</span>{provisionElapsed && <span>{provisionElapsed} elapsed</span>}</div>
                  <div className="h-2 bg-zinc-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${job ? Math.max(2, Math.min(100, job.progress_pct)) : 2}%` }} /></div>
                </div>
              </div>
            )}
            {phase === 'bootstrapping' && (
              <div className="space-y-1.5">
                <p>Infrastructure is up. KubeNest is installing k3s and the KubeNest operator{(cluster.components && (cluster.components.storage || cluster.components.ha || cluster.components.build || cluster.components.monitoring?.enabled)) ? ', plus the requested platform components' : ''}.</p>
                {cluster.components && (cluster.components.storage || cluster.components.ha || cluster.components.build || cluster.components.monitoring?.enabled) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {cluster.components.storage && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px]">Storage (Longhorn)</span>}
                    {cluster.components.ha && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px]">High availability</span>}
                    {cluster.components.build && <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[11px]">Image builds</span>}
                    {cluster.components.monitoring?.enabled && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px]">Monitoring</span>}
                  </div>
                )}
              </div>
            )}
            {phase === 'operator_registering' && (
              <div className="space-y-2">
                <p>Waiting for the KubeNest operator on the cluster to connect back over the websocket. The cluster will flip to <span className="font-medium">Connected</span> once it does.</p>
                {installQ.data?.command && (
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-400">If it&apos;s taking a while, you can re-run the operator install on the cluster:</p>
                    <pre className="bg-zinc-950 text-zinc-300 rounded-md p-3 text-[11px] font-mono whitespace-pre-wrap break-all">{installQ.data.command}</pre>
                  </div>
                )}
              </div>
            )}
            {phase === 'cluster_ready' && <p>Done — the cluster is ready to host projects and apps.</p>}
            {phase === 'provision_failed' && (
              <div className="space-y-3">
                <p className="text-red-700 font-medium">Terraform couldn&apos;t create the infrastructure.</p>
                {job?.error_message && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-red-600 font-medium mb-0.5">Error</p><p className="font-mono text-xs text-red-700 break-words" data-testid="provision-error-detail">{job.error_message}</p></div>
                )}
                <p className="text-xs text-zinc-500">Retrying reuses the retained Terraform state — fix the underlying issue (quota, permissions, region capacity) first, then retry.</p>
                {retry.error instanceof Error && <p className="text-xs text-red-700">{retry.error.message}</p>}
              </div>
            )}
            {phase === 'operator_registration_failed' && (
              <div className="space-y-3" data-testid="operator-registration-failed">
                <p className="text-red-700 font-medium">The operator hasn&apos;t registered with KubeNest.</p>
                <p className="text-zinc-600">The infrastructure is up, but the KubeNest operator running on the cluster hasn&apos;t phoned home. Common causes: the operator install didn&apos;t complete, the operator can&apos;t reach the hub, or the bootstrap token is invalid. <span className="font-medium">This is the only place we ask you to look at the operator.</span></p>
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500">Re-run the operator install command on the cluster — this page picks it up automatically once the operator connects:</p>
                  {installQ.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> fetching install command…</div>
                  ) : installQ.data?.command ? (
                    <pre className="bg-zinc-950 text-zinc-300 rounded-md p-3 text-[11px] font-mono whitespace-pre-wrap break-all">{installQ.data.command}</pre>
                  ) : (
                    <p className="text-xs text-zinc-400">Couldn&apos;t fetch the install command — open the cluster page for it.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between"><p className="text-xs text-zinc-500 font-medium">Diagnostic</p>
                    <button onClick={() => copyDiag.copy(diagnostic)} className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800" data-testid="copy-diagnostic">{copyDiag.copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />} {copyDiag.copied ? 'Copied' : 'Copy'}</button>
                  </div>
                  <pre className="bg-zinc-100 text-zinc-700 rounded-md p-3 text-[11px] font-mono whitespace-pre-wrap break-words" data-testid="diagnostic-text">{diagnostic}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {phase === 'provision_failed' && job && (
              <Button size="sm" onClick={() => retry.mutate()} disabled={retry.isPending} data-testid="retry-provisioning">
                {retry.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />} Retry provisioning
              </Button>
            )}
            {(phase === 'operator_registration_failed' || phase === 'operator_registering' || phase === 'bootstrapping') && (
              <Button size="sm" variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: ['clusters', clusterId] }); queryClient.invalidateQueries({ queryKey: ['provisioning-jobs', clusterId] }); }} data-testid="refresh-status">
                <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
              </Button>
            )}
            {phase === 'cluster_ready' && (
              <Button size="sm" asChild data-testid="view-cluster"><Link href={`/clusters/${clusterId}`}><Server className="h-4 w-4 mr-1.5" /> View cluster</Link></Button>
            )}
            <Button size="sm" variant="ghost" asChild className="text-zinc-500"><Link href={`/clusters/${clusterId}`}>Open cluster page</Link></Button>
          </div>
        </CardContent>
      </Card>

      {/* Job details + logs */}
      {job && (
        <Card className="border-zinc-200">
          <CardHeader className="pb-3"><CardTitle className="text-base">Provisioning job</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-zinc-400">Job ID</p><p className="font-mono text-xs text-zinc-700 break-all">{job.id}</p></div>
              <div><p className="text-xs text-zinc-400">Action</p><p className="text-zinc-700">{job.action}</p></div>
              <div><p className="text-xs text-zinc-400">Started</p><p className="text-zinc-700">{job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}</p></div>
              <div><p className="text-xs text-zinc-400">Completed</p><p className="text-zinc-700">{job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}</p></div>
            </div>
            <LogsPanel jobId={job.id} running={job.status === 'RUNNING' || job.status === 'PENDING'} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
