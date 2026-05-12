'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { appsApi } from '@/lib/api/apps';
import type { AppRead, DeploymentRecord } from '@/types/api';
import { Card, Pill, type PillTone } from '@/components/shell/primitives';

const MAX_APPS = 10;
const MAX_ROWS = 8;

function deployTone(s: DeploymentRecord['status']): PillTone {
  const v = String(s).toLowerCase();
  if (v === 'completed') return 'ok';
  if (v === 'failed') return 'err';
  if (v === 'in_progress' || v === 'running') return 'info';
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

type FeedItem = DeploymentRecord & { _app: AppRead };

/**
 * "Recent deploys" — there's no global deployment-history endpoint yet, so this
 * fans out over the first few apps' `GET /apps/{ns}/{name}/deployments` and
 * merges. Real data, polled. Lighter once a global GET /activity lands (kn-b10).
 */
export function RecentDeploysFeed() {
  const appsQ = useQuery({ queryKey: ['apps', { project_id: null }], queryFn: () => appsApi.list(), refetchInterval: 30_000 });
  const apps = (appsQ.data?.data ?? []).slice(0, MAX_APPS);

  const deploysQ = useQuery({
    queryKey: ['dashboard-recent-deploys', apps.map((a) => `${a.namespace}/${a.name}/${a.project_id}`).join(',')],
    enabled: apps.length > 0,
    refetchInterval: 30_000,
    queryFn: async (): Promise<FeedItem[]> => {
      const lists = await Promise.all(
        apps.map(async (a) => {
          try {
            const res = await appsApi.listDeployments(a.namespace, a.name, a.project_id, 1, 5);
            return res.data.map((d): FeedItem => ({ ...d, _app: a }));
          } catch {
            return [] as FeedItem[];
          }
        }),
      );
      return lists
        .flat()
        .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
        .slice(0, MAX_ROWS);
    },
  });

  const loading = appsQ.isLoading || (apps.length > 0 && deploysQ.isLoading);
  const items = deploysQ.data ?? [];

  return (
    <Card flush>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Recent deploys</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Across all apps · refreshes every 30s</div>
        </div>
        <Link href="/apps" className="text-[12px] hover:underline" style={{ color: 'var(--text-3)' }}>All apps →</Link>
      </div>
      {loading ? (
        <div className="py-8 flex items-center justify-center"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>No deployments yet. Deploy an app to see its history here.</div>
      ) : (
        <div>
          {items.map((d) => (
            <Link
              key={`${d._app.uid}:${d.id}`}
              href={`/apps/${d._app.namespace}/${d._app.name}?project_id=${d._app.project_id}`}
              className="px-4 py-2.5 flex items-start gap-3 hover:bg-[var(--surface-2)] transition-colors text-left"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text)' }}>
                  <span className="font-medium truncate">{d._app.name}</span>
                  <Pill tone={deployTone(d.status)} size="sm">{String(d.status).toLowerCase()}</Pill>
                </div>
                <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>{d.description || '(deploy)'}</div>
                <div className="text-[10.5px] mt-1 flex items-center gap-2 font-mono" style={{ color: 'var(--text-3)' }}>
                  {d.sha && <><span>{d.sha.slice(0, 12)}</span><span>·</span></>}
                  <span>{d.triggered_by}</span>
                  <span>·</span>
                  <span>{timeAgo(d.created_at)}</span>
                </div>
                {d.error_message && <div className="text-[10.5px] mt-1 font-mono" style={{ color: 'var(--err)' }}>{d.error_message}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
