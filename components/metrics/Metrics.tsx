'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { metricsApi } from '@/lib/api/metrics';
import type { MetricsRange, MetricsSeries, MetricsSeriesResponse } from '@/types/api';

export const METRICS_RANGES: MetricsRange[] = ['15m', '1h', '6h', '24h', '7d'];

function fmtValue(v: number, unit: string): string {
  const u = (unit || '').toLowerCase();
  if (u === 'bytes' || u === 'byte') {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let i = 0;
    let n = v;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
    return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
  }
  if (u === 'cores' || u === 'core' || u === 'cpu') return `${v.toFixed(2)} cores`;
  if (u === 'percent' || u === '%') return `${v.toFixed(0)}%`;
  if (u === 'rps' || u === 'req/s') return `${v.toFixed(1)} rps`;
  if (u === 'ms' || u === 's') return `${v.toFixed(0)}${u}`;
  return unit ? `${v.toFixed(2)} ${unit}` : v.toFixed(2);
}

export function MiniChart({ points, color = 'var(--accent)', height = 44 }: { points: [number, number][]; color?: string; height?: number }) {
  if (!points || points.length < 2) return <div style={{ height }} />;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, minY + 1e-9);
  const W = 240;
  const H = height;
  const sx = (x: number) => (maxX === minX ? 0 : ((x - minX) / (maxX - minX)) * W);
  const sy = (y: number) => (maxY === minY ? H : H - ((y - minY) / (maxY - minY)) * H);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} className="block" aria-hidden>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SeriesCard({ s }: { s: MetricsSeries }) {
  const last = s.points.length ? s.points[s.points.length - 1][1] : 0;
  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} data-testid="metrics-series">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{s.name}{s.component ? ` · ${s.component}` : ''}</span>
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text)' }}>{fmtValue(last, s.unit)}</span>
      </div>
      <MiniChart points={s.points} color={s.category === 'cluster_capacity' ? 'var(--info)' : 'var(--accent)'} />
    </div>
  );
}

function EmptyMetrics({ hint, error }: { hint: string; error: boolean }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-[12px]" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }} data-testid="metrics-empty">
      <span style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }} className="text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5 mr-2">No data</span>
      {error ? 'Metrics are temporarily unavailable for this resource.' : hint}
    </div>
  );
}

function RangePicker({ range, onRange }: { range: MetricsRange; onRange: (r: MetricsRange) => void }) {
  return (
    <div className="flex items-center gap-1" data-testid="metrics-range">
      {METRICS_RANGES.map((r) => (
        <button key={r} type="button" onClick={() => onRange(r)} className="text-[11px] px-2 py-0.5 rounded"
          style={{ background: r === range ? 'var(--accent-soft)' : 'transparent', color: r === range ? 'var(--accent)' : 'var(--text-3)' }}>{r}</button>
      ))}
    </div>
  );
}

function MetricsGrid({ data, isLoading, isError, hint, compact = false }: { data?: MetricsSeriesResponse; isLoading: boolean; isError: boolean; hint: string; compact?: boolean }) {
  const series = (data?.series ?? []).filter((s) => s.points && s.points.length > 0);
  if (isLoading) return <div className="py-6 flex items-center justify-center"><Loader2 className="animate-spin" size={16} style={{ color: 'var(--text-3)' }} /></div>;
  if (series.length === 0) return <EmptyMetrics hint={hint} error={isError} />;
  return (
    <div className={compact ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'grid grid-cols-1 md:grid-cols-2 gap-2'} data-testid="metrics-grid">
      {(compact ? series.slice(0, 2) : series).map((s, i) => <SeriesCard key={`${s.name}-${s.component ?? ''}-${i}`} s={s} />)}
    </div>
  );
}

// ── App monitoring (the Monitoring tab + the overview-graphs card) ──────────
export function AppMonitoring({ namespace, name, projectId, compact = false }: { namespace: string; name: string; projectId: string; compact?: boolean }) {
  const [range, setRange] = useState<MetricsRange>('1h');
  const q = useQuery({
    queryKey: ['app-metrics', namespace, name, projectId, range],
    queryFn: () => metricsApi.app(namespace, name, projectId, range),
    enabled: !!namespace && !!name && !!projectId,
    refetchInterval: 30_000,
  });
  return (
    <div className="space-y-3" data-testid="app-monitoring">
      {!compact && <RangePicker range={range} onRange={setRange} />}
      <MetricsGrid data={q.data} isLoading={q.isLoading} isError={q.isError} compact={compact}
        hint="No metrics for this app yet — the cluster needs Prometheus (and the metrics proxy) running, and the app needs to have served traffic." />
    </div>
  );
}

// ── Cluster capacity (the cluster-detail Overview metrics card) ─────────────
export function ClusterMetrics({ clusterId }: { clusterId: string }) {
  const [range, setRange] = useState<MetricsRange>('1h');
  const q = useQuery({
    queryKey: ['cluster-metrics', clusterId, range],
    queryFn: () => metricsApi.cluster(clusterId, range),
    enabled: !!clusterId,
    refetchInterval: 30_000,
  });
  return (
    <div className="space-y-3" data-testid="cluster-metrics">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Cluster capacity</span>
        <RangePicker range={range} onRange={setRange} />
      </div>
      <MetricsGrid data={q.data} isLoading={q.isLoading} isError={q.isError}
        hint="No capacity metrics yet — this cluster needs Prometheus (and the metrics proxy) running." />
    </div>
  );
}

// ── Compact sparkline for dashboard cluster rows ────────────────────────────
export function ClusterSparkline({ clusterId }: { clusterId: string }) {
  const q = useQuery({
    queryKey: ['cluster-metrics', clusterId, '1h'],
    queryFn: () => metricsApi.cluster(clusterId, '1h'),
    enabled: !!clusterId,
    refetchInterval: 60_000,
  });
  const series = (q.data?.series ?? []).filter((s) => s.points && s.points.length > 1);
  if (q.isLoading) return <span className="text-[10px]" style={{ color: 'var(--text-4)' }} data-testid="cluster-sparkline">…</span>;
  if (series.length === 0) return <span className="text-[10px]" style={{ color: 'var(--text-4)' }} title="no metrics" data-testid="cluster-sparkline">—</span>;
  const s = series[0];
  return (
    <span className="inline-block w-20 align-middle" data-testid="cluster-sparkline" title={`${s.name}: ${fmtValue(s.points[s.points.length - 1][1], s.unit)}`}>
      <MiniChart points={s.points} color="var(--info)" height={20} />
    </span>
  );
}
