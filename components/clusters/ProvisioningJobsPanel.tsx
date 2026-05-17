'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { getProvisioningJobLogs, getProvisioningJobs } from '@/api/provisioning';
import type { ConnectionStatus, ProvisioningJob, ProvisioningStatus } from '@/types/api';
import { Card, Pill, type PillTone } from '@/components/shell/primitives';

// Strip ANSI escape sequences (colour codes, cursor moves, …) from log text.
// The ESC byte is built at runtime so the source has no literal control char.
const ANSI_RE = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[A-Za-z]', 'g');
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

const STATUS_TONE: Record<ProvisioningStatus, PillTone> = {
  PENDING: 'default',
  RUNNING: 'info',
  SUCCEEDED: 'ok',
  FAILED: 'err',
};

function fmtDuration(job: ProvisioningJob): string {
  if (!job.started_at) return '—';
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  const secs = Math.max(0, Math.floor((end - new Date(job.started_at).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return m < 60 ? `${m}m ${secs % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function JobLogs({ jobId, running }: { jobId: string; running: boolean }) {
  const logsQ = useQuery({
    queryKey: ['provisioning-job-logs', jobId],
    queryFn: () => getProvisioningJobLogs(jobId),
    refetchInterval: running ? 5000 : false,
  });
  if (logsQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-3)' }} />
      </div>
    );
  }
  const logs = logsQ.data ? stripAnsi(logsQ.data) : null;
  if (!logs) {
    return <div className="py-5 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>No logs available for this job.</div>;
  }
  return (
    <pre
      className="rounded-md p-3 text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed max-h-[28rem] overflow-y-auto"
      style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
    >
      {logs}
    </pre>
  );
}

function JobRow({
  job,
  open,
  onToggle,
}: {
  job: ProvisioningJob;
  open: boolean;
  onToggle: () => void;
}) {
  const running = job.status === 'RUNNING' || job.status === 'PENDING';
  return (
    <div style={{ borderTop: '1px solid var(--border)' }} className="first:border-t-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--surface-2)] transition-colors text-left"
      >
        {open ? <ChevronDown size={14} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />}
        <span className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>{job.action}</span>
        <Pill tone={STATUS_TONE[job.status]} size="sm" dot>{job.status}</Pill>
        <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-3)' }}>{Math.round(job.progress_pct)}%</span>
        {running && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--info)' }} />}
        <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
          {fmtDuration(job)}{job.started_at ? ` · ${new Date(job.started_at).toLocaleString()}` : ''}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
            <span>job <span className="font-mono" style={{ color: 'var(--text-2)' }}>{job.id}</span></span>
            {job.terraform_state_key && <span>tf-state <span className="font-mono" style={{ color: 'var(--text-2)' }}>{job.terraform_state_key}</span></span>}
            {job.completed_at && <span>completed <span style={{ color: 'var(--text-2)' }}>{new Date(job.completed_at).toLocaleString()}</span></span>}
          </div>
          {job.error_message && (
            <div className="rounded-md px-3 py-2 text-[11.5px]" style={{ background: 'var(--err-soft)', color: 'var(--err)' }}>
              <span className="font-medium uppercase tracking-wide text-[10px] block mb-0.5">Error</span>
              <span className="font-mono">{job.error_message}</span>
            </div>
          )}
          <JobLogs jobId={job.id} running={running} />
        </div>
      )}
    </div>
  );
}

export function ProvisioningJobsPanel({
  clusterId,
  connectionStatus,
}: {
  clusterId: string;
  /**
   * Live connection status from the parent. Used to decide how loudly to
   * surface past provisioning failures — a connected cluster's old failure
   * is stale, an unconnected cluster's failure is the user's actual problem.
   * Optional so the panel still works standalone (treats undefined as "show
   * everything", matching the pre-kn-33b behaviour).
   */
  connectionStatus?: ConnectionStatus;
}) {
  const jobsQ = useQuery({
    queryKey: ['provisioning-jobs', clusterId],
    queryFn: () => getProvisioningJobs(clusterId),
    refetchInterval: 5000,
  });
  // `manualOpen === null` means the user hasn't picked a row yet, so we fall
  // back to the auto-default below. Once they click, this captures their
  // choice (or `{ id: null }` if they collapsed everything) and we stop
  // following the default. Avoids a setState-in-effect to seed the default.
  const [manualOpen, setManualOpen] = useState<{ id: string | null } | null>(null);
  // History disclosure (the collapsed group for past failures on a now-healthy
  // cluster). Independent of the open row — opening the disclosure doesn't
  // expand any job body, the user still clicks a row to see logs.
  const [historyOpen, setHistoryOpen] = useState(false);

  const jobs = jobsQ.data ?? [];
  const failedJobs = jobs.filter((j) => j.status === 'FAILED');
  const liveJobs = jobs.filter((j) => j.status !== 'FAILED');
  const isConnected = connectionStatus === 'connected';
  // kn-33b: when the cluster is connected, a past failure is just history —
  // hide it behind a disclosure + banner so users don't read it as "broken".
  // When the cluster is unconnected, the failure is actionable, so we let it
  // render inline and auto-expand the latest one.
  const collapseFailed = isConnected && failedJobs.length > 0;
  const autoOpenId = !isConnected && failedJobs.length > 0 ? failedJobs[0].id : null;
  const openId = manualOpen ? manualOpen.id : autoOpenId;

  if (jobsQ.isLoading) {
    return (
      <Card flush>
        <div className="py-8 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-3)' }} />
        </div>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <div className="py-8 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
          No provisioning jobs for this cluster. Clusters registered by hand (operator install command) don&apos;t have
          provisioning jobs — those are created when KubeNest provisions a cluster via a cloud provider.
        </div>
      </Card>
    );
  }

  const visibleJobs = collapseFailed ? liveJobs : jobs;
  const toggleRow = (id: string) => setManualOpen({ id: openId === id ? null : id });

  return (
    <Card flush>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Provisioning jobs</div>
        <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Terraform / k3s bootstrap runs for this cluster</div>
      </div>

      {collapseFailed && (
        <div
          className="px-4 py-2.5 text-[12px]"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)' }}
          data-testid="provisioning-stale-failure-banner"
        >
          A provisioning step failed but the cluster connected successfully. Expand to view logs.
        </div>
      )}

      {visibleJobs.length > 0 && (
        <div>
          {visibleJobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              open={openId === job.id}
              onToggle={() => toggleRow(job.id)}
            />
          ))}
        </div>
      )}

      {collapseFailed && (
        <div style={{ borderTop: visibleJobs.length > 0 ? '1px solid var(--border)' : undefined }}>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full px-4 py-3 flex items-center gap-2 text-[12.5px] hover:bg-[var(--surface-2)] transition-colors text-left"
            style={{ color: 'var(--text-2)' }}
            data-testid="provisioning-history-toggle"
            aria-expanded={historyOpen}
          >
            {historyOpen ? <ChevronDown size={14} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />}
            <span>View provisioning history</span>
            <span style={{ color: 'var(--text-3)' }} className="text-[11.5px]">
              {failedJobs.length} failed {failedJobs.length === 1 ? 'step' : 'steps'}
            </span>
          </button>
          {historyOpen && (
            <div data-testid="provisioning-history">
              {failedJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  open={openId === job.id}
                  onToggle={() => toggleRow(job.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
