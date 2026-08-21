'use client';

import { useQuery } from '@tanstack/react-query';
import { ArchiveRestore, Clock3 } from 'lucide-react';
import { clustersApi } from '@/lib/api/clusters';
import type { RestoreDrillResult } from '@/types/api';
import { Card, Pill, type PillTone } from '@/components/shell/primitives';

function restoreResult(value: unknown): RestoreDrillResult | null {
  if (!value || typeof value !== 'object') return null;
  const status = (value as { status?: unknown }).status;
  if (status !== 'never_run' && status !== 'passed' && status !== 'failed') return null;
  return value as RestoreDrillResult;
}

function resultPresentation(result: RestoreDrillResult | null, reason?: string) {
  if (!result) return { label: 'Unknown', tone: 'default' as PillTone };
  if (result.status === 'failed') return { label: 'Failed', tone: 'err' as PillTone };
  if (result.status === 'never_run') return { label: 'Never run', tone: 'warn' as PillTone };
  if (reason === 'RESTORE_DRILL_STALE') return { label: 'Stale', tone: 'warn' as PillTone };
  return { label: 'Passed', tone: 'ok' as PillTone };
}

export function ClusterHealthCard({ clusterId }: { clusterId: string }) {
  const q = useQuery({
    queryKey: ['cluster-health', clusterId],
    queryFn: () => clustersApi.getHealth(clusterId),
    refetchInterval: 30_000,
  });
  const backup = q.data?.checks.find((check) => check.check === 'backup');
  const result = restoreResult(backup?.detail.last_restore_drill);
  const presentation = resultPresentation(result, backup?.reason_code);

  return (
    <Card className="col-span-3" data-testid="restore-drill-health">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <ArchiveRestore size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>
                Verified restore
              </span>
              {!q.isLoading && !q.isError && <Pill tone={presentation.tone} size="sm" dot>{presentation.label}</Pill>}
            </div>
            {q.isLoading ? (
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Loading restore evidence…</p>
            ) : q.isError ? (
              <p className="text-[12px] mt-1" style={{ color: 'var(--err)' }}>
                Restore evidence could not be loaded{q.error instanceof Error ? `: ${q.error.message}` : '.'}
              </p>
            ) : (
              <p className="text-[12px] mt-1" style={{ color: backup?.status === 'critical' ? 'var(--err)' : 'var(--text-3)' }}>
                {backup?.message ?? 'The cluster has not reported backup and restore evidence yet.'}
              </p>
            )}
          </div>
        </div>
        {result?.completed_at && (
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
              <Clock3 size={11} /> {new Date(result.completed_at).toLocaleString()}
            </div>
            {result.backup && (
              <div className="text-[10.5px] font-mono mt-1 max-w-[260px] truncate" title={result.backup} style={{ color: 'var(--text-4)' }}>
                {result.backup}
              </div>
            )}
          </div>
        )}
      </div>

      {result?.verification && (
        <div className="mt-3 pt-3 grid grid-cols-3 gap-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>Objects matched</div>
            <div className="text-[12.5px] font-mono mt-0.5" style={{ color: 'var(--text-2)' }}>
              {result.verification.objects.matched}/{result.verification.objects.restored}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>PVC data matched</div>
            <div className="text-[12.5px] font-mono mt-0.5" style={{ color: 'var(--text-2)' }}>
              {result.verification.pvc_data.matched}/{result.verification.pvc_data.restored}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>Duration</div>
            <div className="text-[12.5px] font-mono mt-0.5" style={{ color: 'var(--text-2)' }}>
              {Math.round(result.duration_seconds ?? 0)}s
            </div>
          </div>
        </div>
      )}

      {result?.failure && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }} data-testid="restore-drill-failure">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] font-mono" style={{ color: 'var(--err)' }}>{result.failure.stage}</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>{result.failure.reason_code}</span>
          </div>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-2)' }}>{result.failure.detail}</p>
        </div>
      )}
    </Card>
  );
}
