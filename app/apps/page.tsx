'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Layers, Container, GitBranch, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrg } from '@/hooks/useOrganization';
import { workloadsApi } from '@/lib/api/workloads';
import { clustersApi } from '@/lib/api/clusters';
import { stackTemplatesApi } from '@/lib/api/stack-templates';

const statusColors: Record<string, string> = {
  running: 'bg-emerald-100 text-emerald-700',
  deploying: 'bg-blue-100 text-blue-700',
  building: 'bg-blue-100 text-blue-700',
  pending: 'bg-zinc-100 text-zinc-600',
  degraded: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

const statusDots: Record<string, string> = {
  running: 'bg-emerald-500',
  deploying: 'bg-blue-500',
  building: 'bg-blue-500',
  pending: 'bg-zinc-400',
  degraded: 'bg-amber-500',
  failed: 'bg-red-500',
};

export default function AppsPage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();
  const { orgId } = useCurrentOrg();

  const workloadsQuery = useQuery({
    queryKey: ['workloads', 'org', orgId],
    queryFn: () => workloadsApi.listByOrg(orgId!),
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  const stacksQuery = useQuery({
    queryKey: ['stack-deploys', orgId],
    queryFn: () => stackTemplatesApi.listDeploys(orgId!),
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  const clustersQuery = useQuery({
    queryKey: ['clusters', orgId],
    queryFn: () => clustersApi.list(orgId!),
    enabled: !!orgId,
  });

  const clusterIds = clustersQuery.data?.data.map((c) => c.id) ?? [];
  const projectQueries = useQueries({
    queries: clusterIds.map((id) => ({
      queryKey: ['clusters', id, 'projects'],
      queryFn: () => clustersApi.getProjects(id),
    })),
  });

  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};
    projectQueries.forEach((q) => {
      q.data?.data.forEach((p) => {
        map[p.id] = p.name;
      });
    });
    return map;
  }, [projectQueries]);

  if (!isAuthenticated) return null;

  const workloads = workloadsQuery.data?.data ?? [];
  const stacks = stacksQuery.data?.data ?? [];
  const isLoading = workloadsQuery.isLoading || stacksQuery.isLoading;
  const hasWorkloads = workloads.length > 0;
  const hasStacks = stacks.length > 0;
  const hasAnything = hasWorkloads || hasStacks;

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Apps</h1>
          <p className="text-sm text-zinc-500 mt-0.5">All deployed workloads across your projects.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/settings/stack-templates')}>
            Deploy from Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="border-zinc-200">
          <CardContent className="py-12 text-center text-sm text-zinc-500">Loading apps…</CardContent>
        </Card>
      ) : !hasAnything ? (
        <Card className="border-zinc-200">
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                <Layers className="h-6 w-6 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900">No apps deployed</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Deploy a workload from a project, or use a stack template to get started.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/settings/stack-templates')}>
                Browse Stack Templates
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
      <>
        {hasStacks && (
        <Card className="border-zinc-200">
          <CardHeader className="pb-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-zinc-500" />
              Stacks
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stacks.map((s) => (
                  <TableRow key={`${s.namespace}/${s.name}`}>
                    <TableCell>
                      <p className="font-medium text-zinc-900">{s.name}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-600">
                        {s.template_name}
                        <span className="text-xs text-zinc-400 ml-1">v{s.template_version}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-600">
                        {s.project_id ? (projectNames[s.project_id] ?? s.project_id.slice(0, 8)) : s.namespace}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.components.slice(0, 4).map((c) => (
                          <Badge key={c.name} variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                            {c.name}
                          </Badge>
                        ))}
                        {s.components.length > 4 && (
                          <span className="text-xs text-zinc-400">+{s.components.length - 4}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.phase.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDots[s.phase.toLowerCase()] ?? 'bg-zinc-400'}`} />
                        {s.phase}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        {hasWorkloads && (
        <Card className="border-zinc-200">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Workloads</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Replicas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workloads.map((w) => {
                  const source = w.image ?? w.git_source ?? '—';
                  const isImage = !!w.image;
                  return (
                    <TableRow
                      key={w.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/workloads/${w.id}`)}
                    >
                      <TableCell>
                        <p className="font-medium text-zinc-900">{w.name}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {isImage ? (
                            <Container className="h-3.5 w-3.5 text-zinc-400" />
                          ) : (
                            <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
                          )}
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{source}</code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-zinc-600">
                          {projectNames[w.project_id] ?? w.project_id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-zinc-600">
                          {w.ready_replicas}/{w.replicas}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[w.phase] ?? ''}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDots[w.phase] ?? ''}`} />
                          {w.phase}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}
      </>
      )}
    </div>
  );
}
