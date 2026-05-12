'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { addonDefinitionsApi, addonInstancesApi } from '@/lib/api/addons';
import type { AddonInstance, AddonInstanceRevision, AddonInstanceRevisionStatus } from '@/types/api';

const REVISION_TONE: Record<AddonInstanceRevisionStatus, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Applied: 'bg-emerald-100 text-emerald-700',
  Failed: 'bg-red-100 text-red-700',
};

function currentChartVersion(instance: AddonInstance): string | null {
  const cfg = instance.chart_config as Record<string, unknown> | null;
  const chart = cfg?.chart;
  if (chart && typeof chart === 'object' && !Array.isArray(chart)) {
    const v = (chart as Record<string, unknown>).version;
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

function ChartVersionForm({ instance }: { instance: AddonInstance }) {
  const queryClient = useQueryClient();
  const current = currentChartVersion(instance);

  const defQ = useQuery({
    queryKey: ['addon-definition', instance.definition_id],
    queryFn: () => addonDefinitionsApi.get(instance.definition_id as string),
    enabled: !!instance.definition_id,
  });
  const versions = useMemo(() => {
    const hist = defQ.data?.version_history ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of hist) {
      if (e?.version && !seen.has(e.version)) { seen.add(e.version); out.push(e.version); }
    }
    if (current && !seen.has(current)) out.unshift(current);
    return out;
  }, [defQ.data, current]);

  const [target, setTarget] = useState('');
  const mutation = useMutation({
    mutationFn: (chart_version: string) =>
      addonInstancesApi.patch(instance.id, { chart_version, note: `chart version → ${chart_version}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-instance', instance.id] });
      queryClient.invalidateQueries({ queryKey: ['addon-instance-revisions', instance.id] });
      setTarget('');
    },
  });

  if (!current) return null; // custom instance with no chart ref recorded — nothing to bump
  const errMsg = mutation.error instanceof Error ? mutation.error.message : null;
  const apply = () => { const v = target.trim(); if (v && v !== current) mutation.mutate(v); };

  return (
    <div className="rounded-lg border border-zinc-200 p-4 space-y-3" data-testid="addon-chart-version">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900">Chart version</span>
        <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono" data-testid="addon-current-version">{current}</code>
      </div>
      <p className="text-xs text-zinc-500">Changing the chart version runs a Helm upgrade on the cluster and records a new revision.</p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="addon-target-version" className="text-xs font-medium text-zinc-600 mb-1 block">Target version</Label>
          {versions.length > 1 ? (
            <select
              id="addon-target-version"
              data-testid="addon-target-version"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a version…</option>
              {versions.map((v) => <option key={v} value={v}>{v}{v === current ? ' (current)' : ''}</option>)}
            </select>
          ) : (
            <input
              id="addon-target-version"
              data-testid="addon-target-version"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 15.5.23"
              className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
        <Button
          onClick={apply}
          disabled={mutation.isPending || !target.trim() || target.trim() === current}
          data-testid="addon-apply-version"
        >
          {mutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Upgrading…</> : 'Apply'}
        </Button>
      </div>
      {errMsg && <p className="text-sm text-red-600" data-testid="addon-version-error">Failed to change the chart version: {errMsg}</p>}
    </div>
  );
}

function RevisionRow({
  rev, isLatest, onRollback, rollingBack,
}: { rev: AddonInstanceRevision; isLatest: boolean; onRollback: () => void; rollingBack: boolean }) {
  return (
    <div className="px-3 py-3 rounded-lg border border-zinc-100 bg-zinc-50/60" data-testid="addon-revision-row" data-revision-number={rev.revision_number}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-900">Revision {rev.revision_number}</span>
          <span className={`text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5 ${REVISION_TONE[rev.status] ?? 'bg-zinc-100 text-zinc-600'}`} data-testid="addon-revision-status">{rev.status}</span>
          {isLatest && <span className="text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5 bg-blue-100 text-blue-700">current</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{format(new Date(rev.created_at), 'PPpp')}</span>
          {!isLatest && rev.status !== 'Failed' && (
            <Button variant="outline" size="sm" onClick={onRollback} disabled={rollingBack} data-testid="addon-rollback">
              <RotateCcw className="h-3 w-3 mr-1.5" />Roll back
            </Button>
          )}
        </div>
      </div>
      {rev.note && <p className="text-xs text-zinc-500 mt-1">{rev.note}</p>}
      {rev.status === 'Failed' && rev.error_message && (
        <p className="text-xs text-red-600 mt-1.5 font-mono break-words" data-testid="addon-revision-error">{rev.error_message}</p>
      )}
    </div>
  );
}

/**
 * Versions tab — chart-version change form + the addon instance's revision
 * history (newest-first), with one-click rollback to a prior revision and the
 * FAILED-revision Helm/operator error surfaced (this is also where a failed
 * custom-chart Helm install's error lands — kn-u11 §9.6 / kn-b12).
 */
export function AddonRevisionsPanel({ instance }: { instance: AddonInstance }) {
  const queryClient = useQueryClient();
  const revsQ = useQuery({
    queryKey: ['addon-instance-revisions', instance.id],
    queryFn: () => addonInstancesApi.revisions(instance.id, { items_per_page: 100 }),
    refetchInterval: (q) => {
      const rows = q.state.data?.data ?? [];
      return rows.some((r) => r.status === 'Pending') ? 5000 : false;
    },
  });
  const rollbackMutation = useMutation({
    mutationFn: (revision_number: number) => addonInstancesApi.rollback(instance.id, { revision_number }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-instance', instance.id] });
      queryClient.invalidateQueries({ queryKey: ['addon-instance-revisions', instance.id] });
    },
  });

  const revisions = revsQ.data?.data ?? [];
  const latestNumber = revisions.length ? Math.max(...revisions.map((r) => r.revision_number)) : 0;
  const rollbackErr = rollbackMutation.error instanceof Error ? rollbackMutation.error.message : null;

  return (
    <div className="space-y-4">
      <ChartVersionForm instance={instance} />

      <Card className="border-zinc-200" data-testid="addon-revisions">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-900">Revision history</CardTitle>
          <p className="text-sm text-zinc-500">Every values / chart-version change is recorded. Roll back to restore a prior revision (a Helm upgrade to that config).</p>
        </CardHeader>
        <CardContent>
          {rollbackErr && <p className="text-sm text-red-600 mb-3" data-testid="addon-rollback-error">Failed to roll back: {rollbackErr}</p>}
          {revsQ.isLoading ? (
            <div className="py-6 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-zinc-400" /></div>
          ) : revsQ.isError ? (
            <p className="text-sm text-zinc-400 py-4" data-testid="addon-revisions-unavailable">Revision history isn&apos;t available for this addon.</p>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4">No revisions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {revisions.map((rev) => (
                <RevisionRow
                  key={rev.id}
                  rev={rev}
                  isLatest={rev.revision_number === latestNumber}
                  rollingBack={rollbackMutation.isPending}
                  onRollback={() => rollbackMutation.mutate(rev.revision_number)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
