'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus } from 'lucide-react';
import { getClusters } from '@/api/clusters';
import { getProjects } from '@/api/projects';
import { useCurrentOrg } from '@/hooks/useOrganization';
import { Btn, Card, Pill, StatusDot, statusTone } from '@/components/shell/primitives';

export default function ProjectsPage() {
  const router = useRouter();
  const { orgId } = useCurrentOrg();
  const [clusterFilter, setClusterFilter] = useState('all');

  const { data: clustersData, isLoading: clustersLoading, isError: clustersError, error: clustersErr } = useQuery({
    queryKey: ['clusters', orgId],
    queryFn: () => getClusters(orgId!),
    enabled: !!orgId,
  });
  const clusters = clustersData?.data ?? [];

  const { data: projectsData, isLoading: projectsLoading, isError: projectsError, error: projectsErr } = useQuery({
    queryKey: ['projects', 'all', orgId],
    queryFn: async () => {
      if (clusters.length === 0) return { data: [] as Array<Awaited<ReturnType<typeof getProjects>>['data'][number] & { cluster_name?: string }> };
      const results = await Promise.all(clusters.map((c) => getProjects(c.id)));
      return {
        data: results.flatMap((r, i) => r.data.map((p) => ({ ...p, cluster_name: clusters[i]?.name }))),
      };
    },
    enabled: !!clustersData,
  });

  const projects = useMemo(() => {
    const all = projectsData?.data ?? [];
    return clusterFilter === 'all' ? all : all.filter((p) => p.cluster_id === clusterFilter);
  }, [projectsData, clusterFilter]);

  const isLoading = clustersLoading || projectsLoading;
  const createHref = clusters.length > 0 ? `/clusters/${clusters[0].id}/projects/new` : null;

  return (
    <div className="px-6 py-5 max-w-[1100px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Projects</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            Namespaces in your clusters — each holds a flat set of apps and addons.
          </p>
        </div>
        <Btn variant="primary" size="sm" icon={Plus} disabled={!createHref} onClick={() => createHref && router.push(createHref)}>New project</Btn>
      </div>

      <Card flush>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>All projects</div>
          {clusters.length > 1 && (
            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              className="h-7 rounded-md border px-2 text-[12px] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All clusters</option>
              {clusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        {isLoading ? (
          <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>Loading projects…</div>
        ) : clustersError ? (
          <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--err)' }}>
            Failed to load clusters{clustersErr instanceof Error ? `: ${clustersErr.message}` : '.'}
          </div>
        ) : projectsError ? (
          <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--err)' }}>
            Failed to load projects{projectsErr instanceof Error ? `: ${projectsErr.message}` : '.'}
          </div>
        ) : clusters.length === 0 ? (
          <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            No clusters yet. <Link href="/clusters/new" className="hover:underline" style={{ color: 'var(--accent)' }}>Register one</Link> before creating projects.
          </div>
        ) : projects.length === 0 ? (
          <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>No projects yet in {clusterFilter === 'all' ? 'any cluster' : 'this cluster'}.</div>
        ) : (
          <div>
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="grid grid-cols-12 items-center px-4 py-3 hover:bg-[var(--surface-2)] transition-colors text-left"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><FolderKanban size={12} /></span>
                  <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{p.name}</span>
                </div>
                <div className="col-span-3 text-[11.5px] font-mono truncate" style={{ color: 'var(--text-3)' }}>{p.namespace}</div>
                <div className="col-span-3 text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>{p.cluster_name ?? p.cluster_id.slice(0, 8)}</div>
                <div className="col-span-1 text-right flex items-center justify-end gap-1.5">
                  <StatusDot status={statusTone(p.status)} pulse={statusTone(p.status) === 'warn'} />
                  <Pill tone={statusTone(p.status) === 'ok' ? 'ok' : statusTone(p.status) === 'warn' ? 'warn' : statusTone(p.status) === 'err' ? 'err' : 'default'} size="sm">{p.status}</Pill>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
