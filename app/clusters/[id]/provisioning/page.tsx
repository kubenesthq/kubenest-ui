'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Loader2,
  Server,
  AlertCircle,
  Clock,
  RefreshCw,
  Circle,
  Terminal,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { getCluster } from '@/api/clusters';
import { getProvisioningJobs, getProvisioningJobLogs } from '@/api/provisioning';
import type { Cluster, ProvisioningJob, ProvisioningStatus } from '@/types/api';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};
const easeOutQuart = [0.25, 1, 0.5, 1] as const;

interface Stage {
  label: string;
  range: [number, number]; // progress_pct range
}

const STAGES: Stage[] = [
  { label: 'Initializing', range: [0, 10] },
  { label: 'Provisioning VMs', range: [10, 40] },
  { label: 'Installing k3s', range: [40, 70] },
  { label: 'Bootstrapping cluster', range: [70, 95] },
  { label: 'Ready', range: [95, 100] },
];

function getCurrentStageIndex(pct: number): number {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (pct >= STAGES[i].range[0]) return i;
  }
  return 0;
}

function formatElapsed(startIso: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

const statusColors: Record<ProvisioningStatus, string> = {
  PENDING: 'bg-zinc-100 text-zinc-600',
  RUNNING: 'bg-blue-100 text-blue-700',
  SUCCEEDED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
};

const POLL_INTERVAL = 3000;

export default function ProvisioningProgressPage() {
  const router = useRouter();
  const params = useParams();
  const clusterId = params.id as string;
  const { isAuthenticated } = useAuth(true);

  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [job, setJob] = useState<ProvisioningJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('');
  const [logs, setLogs] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [clusterData, jobs] = await Promise.all([
        getCluster(clusterId),
        getProvisioningJobs(clusterId),
      ]);
      setCluster(clusterData);
      if (jobs.length > 0) {
        setJob(jobs[0]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provisioning status');
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  const fetchLogs = useCallback(async () => {
    if (!job) return;
    setLogsLoading(true);
    try {
      const logText = await getProvisioningJobLogs(job.id);
      setLogs(logText);
    } catch {
      // non-fatal
    } finally {
      setLogsLoading(false);
    }
  }, [job?.id]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, logsOpen]);

  // Fetch logs when panel is opened, and poll while running
  useEffect(() => {
    if (!logsOpen || !job) return;
    fetchLogs();
    if (job.status === 'RUNNING') {
      const logPoll = setInterval(fetchLogs, 5000);
      return () => clearInterval(logPoll);
    }
  }, [logsOpen, job?.status, fetchLogs]);

  // Initial fetch + polling
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();

    pollRef.current = setInterval(async () => {
      try {
        const jobs = await getProvisioningJobs(clusterId);
        if (jobs.length > 0) {
          const latest = jobs[0];
          setJob(latest);
          if (latest.status === 'SUCCEEDED' || latest.status === 'FAILED') {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        // retry on next tick
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated, clusterId, fetchData]);

  // Elapsed time ticker
  useEffect(() => {
    if (!job?.started_at) return;
    if (job.status === 'SUCCEEDED' || job.status === 'FAILED') {
      // Show final elapsed
      const end = job.completed_at || new Date().toISOString();
      const secs = Math.floor((new Date(end).getTime() - new Date(job.started_at).getTime()) / 1000);
      const mins = Math.floor(secs / 60);
      setElapsed(mins < 60 ? `${mins}m ${secs % 60}s` : `${Math.floor(mins / 60)}h ${mins % 60}m`);
      return;
    }
    const tick = () => setElapsed(formatElapsed(job.started_at!));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [job?.started_at, job?.status, job?.completed_at]);

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="px-8 py-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error && !cluster) {
    return (
      <div className="px-8 py-8 max-w-3xl space-y-4">
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const stageIndex = job ? getCurrentStageIndex(job.progress_pct) : 0;
  const isTerminal = job?.status === 'SUCCEEDED' || job?.status === 'FAILED';

  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: easeOutQuart }}
      >
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2">
          <Link href={`/clusters/${clusterId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Cluster
          </Link>
        </Button>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Provisioning {cluster?.name || clusterId}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {isTerminal
            ? job?.status === 'SUCCEEDED'
              ? 'Cluster provisioning completed successfully.'
              : 'Cluster provisioning failed.'
            : 'Infrastructure is being set up. This may take several minutes.'}
        </p>
      </motion.div>

      {/* Status Overview */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Status</CardTitle>
              {job && (
                <div className="flex items-center gap-3">
                  {elapsed && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      {elapsed}
                    </div>
                  )}
                  <Badge className={`text-xs ${statusColors[job.status]}`}>
                    {job.status}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!job ? (
              <div className="text-center py-6 space-y-2">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-300 mx-auto" />
                <p className="text-xs text-zinc-400">Waiting for provisioning job to be created...</p>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>{STAGES[stageIndex].label}</span>
                    <span>{Math.round(job.progress_pct)}%</span>
                  </div>
                  <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        job.status === 'SUCCEEDED'
                          ? 'bg-emerald-500'
                          : job.status === 'FAILED'
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${job.progress_pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Stages */}
                <div className="space-y-2">
                  {STAGES.map((stage, i) => {
                    const isDone = job.status === 'SUCCEEDED'
                      ? true
                      : job.status === 'FAILED'
                        ? i < stageIndex
                        : i < stageIndex;
                    const isCurrent = i === stageIndex && !isTerminal;
                    const isFailed = job.status === 'FAILED' && i === stageIndex;

                    return (
                      <div key={stage.label} className="flex items-center gap-3">
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          {isDone ? (
                            <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center">
                              <Check className="h-3 w-3 text-emerald-600" />
                            </div>
                          ) : isFailed ? (
                            <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
                              <AlertCircle className="h-3 w-3 text-red-500" />
                            </div>
                          ) : isCurrent ? (
                            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-zinc-200" />
                          )}
                        </div>
                        <span
                          className={`text-sm ${
                            isDone
                              ? 'text-zinc-500'
                              : isCurrent || isFailed
                                ? 'text-zinc-900 font-medium'
                                : 'text-zinc-300'
                          }`}
                        >
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Error message */}
                {job.error_message && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    <p className="font-medium text-xs uppercase tracking-wide mb-1">Error</p>
                    <p className="font-mono text-xs">{job.error_message}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Job Details */}
      {job && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.15, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Job Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-zinc-400">Job ID</p>
                  <p className="font-mono text-xs text-zinc-700 truncate">{job.id}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Action</p>
                  <p className="text-zinc-700">{job.action}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Started</p>
                  <p className="text-zinc-700">
                    {job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Completed</p>
                  <p className="text-zinc-700">
                    {job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Logs Viewer */}
      {job && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.2, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setLogsOpen((prev) => !prev)}
              >
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-zinc-400" />
                  Provisioning Logs
                </CardTitle>
                <div className="flex items-center gap-2">
                  {logsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                  {logsOpen ? (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
              </button>
            </CardHeader>
            {logsOpen && (
              <CardContent>
                {logs ? (
                  <div className="bg-zinc-950 rounded-md p-4 max-h-96 overflow-auto">
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                      {logs}
                    </pre>
                    <div ref={logsEndRef} />
                  </div>
                ) : logsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-xs text-zinc-400">
                      {job.status === 'PENDING'
                        ? 'Logs will appear once provisioning starts.'
                        : 'No logs available.'}
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {job?.status === 'FAILED' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setJob(null);
              setLoading(true);
              fetchData();
              // Restart polling
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = setInterval(async () => {
                try {
                  const jobs = await getProvisioningJobs(clusterId);
                  if (jobs.length > 0) {
                    const latest = jobs[0];
                    setJob(latest);
                    if (latest.status === 'SUCCEEDED' || latest.status === 'FAILED') {
                      if (pollRef.current) clearInterval(pollRef.current);
                    }
                  }
                } catch { /* retry */ }
              }, POLL_INTERVAL);
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh Status
          </Button>
        )}
        {job?.status === 'SUCCEEDED' && (
          <Button size="sm" onClick={() => router.push(`/clusters/${clusterId}`)}>
            <Server className="h-4 w-4 mr-1.5" />
            View Cluster
          </Button>
        )}
      </div>
    </div>
  );
}
