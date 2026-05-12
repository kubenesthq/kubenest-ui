'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Loader2, Scaling } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getProvisioningJob } from '@/api/provisioning';
import { useScaleCluster } from '@/hooks/useClusters';
import type { Cluster, ProvisioningJob, ProvisioningStatus } from '@/types/api';
import { Btn, Card, Pill, SectionLabel, type PillTone } from '@/components/shell/primitives';

const STATUS_TONE: Record<ProvisioningStatus, PillTone> = {
  PENDING: 'default',
  RUNNING: 'info',
  SUCCEEDED: 'ok',
  FAILED: 'err',
};

function isTerminal(s: ProvisioningStatus): boolean {
  return s === 'SUCCEEDED' || s === 'FAILED';
}

const inputBase = 'h-8 rounded-md border px-2.5 text-[13px]';
const inputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' } as const;

// Progress / outcome of an in-flight (or just-finished) SCALE provisioning job.
function ScaleJobStatus({ job }: { job: ProvisioningJob }) {
  const running = job.status === 'PENDING' || job.status === 'RUNNING';
  return (
    <div data-testid="scale-job" className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-[12px]">
        <Pill tone={STATUS_TONE[job.status]} size="sm" dot>{job.status}</Pill>
        <span className="tabular-nums" style={{ color: 'var(--text-3)' }}>{Math.round(job.progress_pct)}%</span>
        {running && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--info)' }} />}
        <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-4)' }}>job {job.id}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, Math.min(100, job.progress_pct))}%`, background: job.status === 'FAILED' ? 'var(--err)' : 'var(--accent)' }}
        />
      </div>
      {job.status === 'FAILED' && job.error_message && (
        <div className="rounded-md px-3 py-2 text-[11.5px]" style={{ background: 'var(--err-soft)', color: 'var(--err)' }}>
          <span className="font-medium uppercase tracking-wide text-[10px] block mb-0.5">Scale failed</span>
          <span className="font-mono">{job.error_message}</span>
        </div>
      )}
      {job.status === 'SUCCEEDED' && (
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ok)' }}>
          <Check size={13} /> Terraform converged — the cluster reports the new node count once the operator heartbeats.
        </div>
      )}
      {running && (
        <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          Terraform is applying the new node count. Watch the run under the <span className="font-medium">Provisioning</span> tab.
        </p>
      )}
    </div>
  );
}

export function ClusterScaleCard({ cluster }: { cluster: Cluster }) {
  const queryClient = useQueryClient();
  const current = cluster.node_count ?? 0;
  const [desired, setDesired] = useState<string>(String(Math.max(1, current || 1)));
  const [nodeSize, setNodeSize] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const scale = useScaleCluster(cluster.id);

  const jobQ = useQuery({
    queryKey: ['provisioning-job', jobId],
    queryFn: () => getProvisioningJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = (q.state.data as ProvisioningJob | undefined)?.status;
      return s && !isTerminal(s) ? 4000 : (false as const);
    },
  });
  const job = jobQ.data ?? null;

  // When the SCALE job finishes, re-fetch the cluster so the node count refreshes.
  useEffect(() => {
    if (job && isTerminal(job.status)) {
      queryClient.invalidateQueries({ queryKey: ['clusters', cluster.id] });
    }
  }, [job, queryClient, cluster.id]);

  const desiredNum = Number(desired);
  const valid = Number.isInteger(desiredNum) && desiredNum >= 1;
  const inFlight = scale.isPending || (!!job && !isTerminal(job.status));
  const unchanged = valid && desiredNum === current && nodeSize.trim() === '';
  const errMsg = scale.error instanceof Error ? scale.error.message : null;

  const submit = async () => {
    if (!valid || inFlight) return;
    scale.reset();
    try {
      const res = await scale.mutateAsync({
        desired_node_count: desiredNum,
        desired_node_size: nodeSize.trim() || undefined,
      });
      setJobId(res.provisioning_job.id);
    } catch {
      /* surfaced via scale.error */
    }
  };

  return (
    <Card data-testid="cluster-scale-card">
      <div className="flex items-center gap-2 mb-1.5">
        <Scaling size={14} style={{ color: 'var(--text-3)' }} />
        <SectionLabel>Scale</SectionLabel>
      </div>
      <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
        Change the node count of this cluster. Available for Terraform-provisioned clusters — runs a Terraform apply as a{' '}
        <span className="font-medium">SCALE</span> provisioning job. Current: <span className="font-medium tabular-nums" style={{ color: 'var(--text-2)' }} data-testid="scale-current-count">{current}</span> node{current === 1 ? '' : 's'}.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Target nodes</span>
          <input
            type="number"
            min={1}
            data-testid="scale-node-count"
            value={desired}
            onChange={(e) => setDesired(e.target.value)}
            disabled={inFlight}
            className={`${inputBase} w-24 tabular-nums`}
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[10rem]">
          <span className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Node size (optional)</span>
          <input
            type="text"
            placeholder="e.g. s-4vcpu-8gb"
            data-testid="scale-node-size"
            value={nodeSize}
            onChange={(e) => setNodeSize(e.target.value)}
            disabled={inFlight}
            className={`${inputBase} w-full`}
            style={inputStyle}
          />
        </label>
        <Btn
          variant="primary"
          size="sm"
          data-testid="scale-submit"
          disabled={!valid || inFlight || unchanged}
          onClick={submit}
        >
          {scale.isPending && <Loader2 size={12} className="animate-spin" />}
          Scale cluster
        </Btn>
      </div>
      {!valid && desired.trim() !== '' && (
        <p className="mt-2 text-[11.5px]" style={{ color: 'var(--err)' }}>Node count must be a whole number ≥ 1.</p>
      )}
      {errMsg && (
        <div data-testid="scale-error" className="mt-3 rounded-md px-3 py-2 flex items-start gap-2 text-[11.5px]" style={{ background: 'var(--err-soft)', color: 'var(--err)' }}>
          <AlertCircle size={13} className="mt-px shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}
      {job && <ScaleJobStatus job={job} />}
    </Card>
  );
}
