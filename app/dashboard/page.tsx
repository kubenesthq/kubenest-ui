'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Box, Boxes, Cpu, FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { getAllProjects } from '@/api/projects';
import { appsApi } from '@/lib/api/apps';
import { getRecents } from '@/lib/recents';
import { useClusters } from '@/hooks/useClusters';
import { useAuth } from '@/hooks/useAuth';
import type { Cluster } from '@/types/api';
import { getConnectionStatus } from '@/types/api';
import { RecentDeploysFeed } from '@/components/dashboard/RecentDeploysFeed';
import { Btn, Card, Pill, StatusDot, statusTone, type PillTone } from '@/components/shell/primitives';

type IconType = React.ComponentType<{ size?: number }>;

function HeroStat({ label, value, sub, icon: Icon, stub = false }: { label: string; value: React.ReactNode; sub: string; icon: IconType; stub?: boolean }) {
  return (
    <div className="px-5 py-5 border-r last:border-r-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ background: 'var(--accent-soft)', color: stub ? 'var(--text-3)' : 'var(--accent)' }} className="w-6 h-6 rounded-md flex items-center justify-center"><Icon size={12} /></span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.06em]" style={{ color: 'var(--text-3)' }}>{label}</span>
      </div>
      <div className="text-[28px] font-semibold leading-none tracking-tight" style={{ color: stub ? 'var(--text-3)' : 'var(--text)' }}>{value}</div>
      <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>{sub}</div>
    </div>
  );
}

function clusterTone(c: Cluster): PillTone {
  const s = getConnectionStatus(c);
  return s === 'connected' ? 'ok' : s === 'pending' ? 'warn' : 'err';
}
function clusterLabel(c: Cluster): string {
  const s = getConnectionStatus(c);
  return s === 'connected' ? 'connected' : s === 'pending' ? 'pending' : 'disconnected';
}

function ClusterFleetPanel({ clusters, loading }: { clusters: Cluster[]; loading: boolean }) {
  const healthy = clusters.filter((c) => getConnectionStatus(c) === 'connected').length;
  const pending = clusters.filter((c) => getConnectionStatus(c) === 'pending').length;
  const down = clusters.filter((c) => getConnectionStatus(c) === 'disconnected').length;
  return (
    <Card flush>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Cluster fleet</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            Health and registration. <span style={{ color: 'var(--text-4)' }}>Capacity & utilisation bars land with kn-b11 (metrics).</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {healthy > 0 && <Pill tone="ok" size="sm" dot>{healthy} connected</Pill>}
          {pending > 0 && <Pill tone="warn" size="sm" dot>{pending} pending</Pill>}
          {down > 0 && <Pill tone="err" size="sm" dot>{down} down</Pill>}
        </div>
      </div>
      {loading ? (
        <div className="py-10 flex items-center justify-center"><span className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>Loading clusters…</span></div>
      ) : clusters.length === 0 ? (
        <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
          No clusters yet. <Link href="/clusters/new" className="hover:underline" style={{ color: 'var(--accent)' }}>Register one</Link> to get started.
        </div>
      ) : (
        <div>
          {clusters.map((c) => (
            <Link
              key={c.id}
              href={`/clusters/${c.id}`}
              className="grid grid-cols-12 items-center px-4 py-3 hover:bg-[var(--surface-2)] transition-colors text-left"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                <StatusDot status={statusTone(c.status)} pulse={statusTone(c.status) === 'warn'} />
                <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{c.name}</span>
                {c.kubernetes_version && <span className="text-[10px] px-1 py-0.5 rounded font-mono" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{c.kubernetes_version}</span>}
              </div>
              <div className="col-span-4 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                {(c.base_domain || c.enterprise_domain) ?? '—'}
              </div>
              <div className="col-span-2 text-[11.5px] font-mono" style={{ color: 'var(--text-2)' }}>{c.node_count ?? 0} nodes</div>
              <div className="col-span-1 text-right"><Pill tone={clusterTone(c)} size="sm" dot>{clusterLabel(c)}</Pill></div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

const RECENT_ICON: Record<string, IconType> = { app: Box, project: FolderKanban, cluster: Boxes, template: Activity };

function RecentsCard() {
  // Read once on mount — localStorage isn't reactive; the dashboard remounts on
  // navigation anyway, so this stays reasonably fresh.
  const recents = useMemo(() => getRecents(), []);
  return (
    <Card flush>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Jump back in</div>
        <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Recently visited</div>
      </div>
      {recents.length === 0 ? (
        <div className="py-6 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>Nothing yet — open a cluster, project or app and it&apos;ll show up here.</div>
      ) : (
        <div>
          {recents.map((rc) => {
            const Icon = RECENT_ICON[rc.kind] ?? Box;
            return (
              <Link key={`${rc.kind}:${rc.id}`} href={rc.href} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--surface-2)] transition-colors" style={{ borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-3)' }} className="shrink-0"><Icon size={14} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{rc.label}</span>
                  {rc.sub && <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{rc.sub}</span>}
                </span>
                <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{rc.kind}</span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth(true);
  const clustersQ = useClusters();
  const projectsQ = useQuery({ queryKey: ['projects', 'all'], queryFn: getAllProjects });
  const appsQ = useQuery({ queryKey: ['apps', { project_id: null }], queryFn: () => appsApi.list() });

  const clusters = clustersQ.data?.data ?? [];
  const projectCount = projectsQ.data?.data?.length ?? 0;
  const appCount = appsQ.data?.data?.length ?? 0;
  const connected = clusters.filter((c) => getConnectionStatus(c) === 'connected').length;
  const degraded = clusters.length - connected;

  if (!isAuthenticated) return null;

  return (
    <div className="px-6 py-5 max-w-[1280px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Overview</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            Fleet posture across {clusters.length} cluster{clusters.length === 1 ? '' : 's'} · {projectCount} project{projectCount === 1 ? '' : 's'} · {appCount} app{appCount === 1 ? '' : 's'}
          </p>
        </div>
        <Btn variant="primary" size="sm" icon={Plus} onClick={() => router.push('/apps/new')}>New app</Btn>
      </div>

      {/* Hero strip */}
      <Card flush className="overflow-hidden mb-4">
        <div className="grid grid-cols-4">
          <HeroStat label="Clusters" value={clusters.length} sub={`${connected} connected · ${degraded} degraded`} icon={Boxes} />
          <HeroStat label="Apps" value={appCount} sub="across all projects" icon={Box} />
          <HeroStat label="Projects" value={projectCount} sub="namespaces in clusters" icon={FolderKanban} />
          <HeroStat label="Fleet capacity" value="—" sub="not yet available · kn-b11 (metrics)" icon={Cpu} stub />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <ClusterFleetPanel clusters={clusters} loading={clustersQ.isLoading} />
        </div>
        <div className="space-y-4">
          <RecentDeploysFeed />
          <RecentsCard />
        </div>
      </div>
    </div>
  );
}
