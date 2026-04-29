'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Layers, Package, Database, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrg } from '@/hooks/useOrganization';
import { clustersApi } from '@/lib/api/clusters';
import { stackTemplatesApi } from '@/lib/api/stack-templates';
import { addonInstancesApi } from '@/lib/api/addons';

const statusColors: Record<string, string> = {
  running: 'bg-emerald-100 text-emerald-700',
  deploying: 'bg-blue-100 text-blue-700',
  pending: 'bg-zinc-100 text-zinc-600',
  degraded: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

const statusDots: Record<string, string> = {
  running: 'bg-emerald-500',
  deploying: 'bg-blue-500',
  pending: 'bg-zinc-400',
  degraded: 'bg-amber-500',
  failed: 'bg-red-500',
};

export default function AppsPage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();
  const { orgId } = useCurrentOrg();

  // /stack-deploys is the cross-cluster aggregator over StackDeploy CRDs.
  // Both template-based and inline (custom) apps land here, so it doubles as the apps list.
  const stacksQuery = useQuery({
    queryKey: ['stack-deploys', orgId],
    queryFn: () => stackTemplatesApi.listDeploys(orgId!),
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  const addonsQuery = useQuery({
    queryKey: ['addon-instances', 'org', orgId],
    queryFn: () => addonInstancesApi.listByOrg(orgId!),
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

  const stacks = stacksQuery.data?.data ?? [];
  const addons = addonsQuery.data?.data ?? [];
  const isLoading = stacksQuery.isLoading || addonsQuery.isLoading;
  const hasStacks = stacks.length > 0;
  const hasAddons = addons.length > 0;
  const hasAnything = hasStacks || hasAddons;

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Apps</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            All deployed apps across your projects.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/settings/stack-templates')}>
            From Template
          </Button>
          <Button size="sm" onClick={() => router.push('/apps/new')}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New App
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
                  Create a new app or deploy from a stack template to get started.
                </p>
              </div>
              <Button size="sm" onClick={() => router.push('/apps/new')}>
                Create App
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
                  Apps
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
                    {stacks.map((s) => {
                      const href = s.project_id
                        ? `/apps/${s.namespace}/${s.name}?project_id=${s.project_id}`
                        : null;
                      return (
                        <TableRow
                          key={`${s.namespace}/${s.name}`}
                          className={href ? 'cursor-pointer' : ''}
                          onClick={() => href && router.push(href)}
                        >
                          <TableCell>
                            <p className="font-medium text-zinc-900">{s.name}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-zinc-600">
                              {s.template_name ? (
                                <>
                                  {s.template_name}
                                  <span className="text-xs text-zinc-400 ml-1">v{s.template_version}</span>
                                </>
                              ) : (
                                <span className="text-zinc-400">inline</span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-zinc-600">
                              {s.project_id
                                ? projectNames[s.project_id] ?? s.project_id.slice(0, 8)
                                : s.namespace}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {hasAddons && (
            <Card className="border-zinc-200">
              <CardHeader className="pb-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-zinc-500" />
                  Standalone Addons
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addons.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <p className="font-medium text-zinc-900">{a.name}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                            {a.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-zinc-600">
                            {projectNames[a.project_id] ?? a.project_id.slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.phase.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDots[a.phase.toLowerCase()] ?? 'bg-zinc-400'}`} />
                            {a.phase}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
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
