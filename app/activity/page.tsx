'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Loader2, RotateCw } from 'lucide-react';
import { appsApi } from '@/lib/api/apps';
import { getAllProjects } from '@/api/projects';
import { useAuth } from '@/hooks/useAuth';
import { Btn, Card, Pill, type PillTone } from '@/components/shell/primitives';
import type { AppRead, DeploymentRecord, DeploymentStatus } from '@/types/api';

const MAX_APPS = 24;
const MAX_ROWS = 60;
const PER_APP_ROWS = 10;

function deployTone(s: DeploymentStatus): PillTone {
  const v = String(s).toLowerCase();
  if (v === 'completed') return 'ok';
  if (v === 'failed') return 'err';
  if (v === 'in_progress' || v === 'pending') return 'info';
  return 'default';
}

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(d / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type ActivityItem = DeploymentRecord & { _app: AppRead };
type StatusFilter = 'all' | DeploymentStatus;

export default function ActivityPage() {
  const { isAuthenticated } = useAuth(true);
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const projectsQ = useQuery({ queryKey: ['projects'], queryFn: () => getAllProjects() });
  const projects = useMemo(() => projectsQ.data?.data ?? [], [projectsQ.data]);
  const projectName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects) m[p.id] = p.display_name || p.name;
    return m;
  }, [projects]);

  const appsQ = useQuery({ queryKey: ['apps', { project_id: null }], queryFn: () => appsApi.list(), refetchInterval: 30_000 });
  const apps = useMemo(() => {
    const all = appsQ.data?.data ?? [];
    return (projectFilter === 'all' ? all : all.filter((a) => a.project_id === projectFilter)).slice(0, MAX_APPS);
  }, [appsQ.data, projectFilter]);

  const eventsQ = useQuery({
    queryKey: ['activity-events', apps.map((a) => `${a.namespace}/${a.name}/${a.project_id}`).join(',')],
    enabled: apps.length > 0,
    refetchInterval: 20_000,
    queryFn: async (): Promise<ActivityItem[]> => {
      const lists = await Promise.all(
        apps.map(async (a) => {
          try {
            const res = await appsApi.listDeployments(a.namespace, a.name, a.project_id, 1, PER_APP_ROWS);
            return res.data.map((d): ActivityItem => ({ ...d, _app: a }));
          } catch {
            return [] as ActivityItem[];
          }
        }),
      );
      return lists
        .flat()
        .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
        .slice(0, MAX_ROWS);
    },
  });

  const items = useMemo(() => {
    const all = eventsQ.data ?? [];
    return statusFilter === 'all' ? all : all.filter((d) => d.status === statusFilter);
  }, [eventsQ.data, statusFilter]);

  const loading = appsQ.isLoading || projectsQ.isLoading || (apps.length > 0 && eventsQ.isLoading);
  const refreshing = eventsQ.isFetching && !eventsQ.isLoading;

  if (!isAuthenticated) return null;

  const selectStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' } as const;

  return (
    <div className="px-6 py-5 max-w-[1000px] mx-auto">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Activity</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            Deployment activity across your apps — real events only.{' '}
            <span style={{ color: 'var(--text-4)' }}>Cluster, addon, RBAC, secret, project and provisioning events join this feed with kn-B10.</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={selectStyle} className="h-7 rounded-md border px-2 text-[12px] focus:outline-none focus:border-[var(--accent)]">
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={selectStyle} className="h-7 rounded-md border px-2 text-[12px] focus:outline-none focus:border-[var(--accent)]">
            <option value="all">Any status</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In progress</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <Btn variant="default" size="sm" icon={RotateCw} onClick={() => eventsQ.refetch()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</Btn>
        </div>
      </div>

      <Card flush>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Activity feed</div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{items.length} event{items.length === 1 ? '' : 's'} · auto-refreshes</div>
        </div>
        {loading ? (
          <div className="py-10 flex items-center justify-center"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            {apps.length === 0 ? 'No apps yet — deploy one to start the activity feed.' : 'No deployment activity yet for this filter.'}
          </div>
        ) : (
          <div>
            {items.map((d) => (
              <Link
                key={`${d._app.uid}:${d.id}`}
                href={`/apps/${d._app.namespace}/${d._app.name}?project_id=${d._app.project_id}`}
                className="px-4 py-2.5 flex items-start gap-3 hover:bg-[var(--surface-2)] transition-colors text-left"
                style={{ borderTop: '1px solid var(--border)' }}
                data-testid="activity-event"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[12px] flex-wrap" style={{ color: 'var(--text)' }}>
                    <span className="font-medium truncate">{d._app.name}</span>
                    <Pill tone={deployTone(d.status)} size="sm">{String(d.status).toLowerCase().replace('_', ' ')}</Pill>
                    <span style={{ color: 'var(--text-4)' }}>· {projectName[d._app.project_id] ?? d._app.namespace}</span>
                  </div>
                  <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>{d.description || '(deploy)'}</div>
                  <div className="text-[10.5px] mt-1 flex items-center gap-2 font-mono flex-wrap" style={{ color: 'var(--text-3)' }}>
                    {d.sha && <><span>{d.sha.slice(0, 12)}</span><span>·</span></>}
                    <span>{d.triggered_by}</span>
                    <span>·</span>
                    <span>{timeAgo(d.created_at)}</span>
                    {d.completed_at && <><span>·</span><span>done {timeAgo(d.completed_at)}</span></>}
                  </div>
                  {d.error_message && <div className="text-[10.5px] mt-1 font-mono" style={{ color: 'var(--err)' }}>{d.error_message}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
