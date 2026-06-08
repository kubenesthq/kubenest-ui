'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Layers, Package, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { appsApi } from '@/lib/api/apps';
import { getAllProjects } from '@/api/projects';

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

const STALE_PHASES = new Set(['unknown', '']);

export default function AppsPage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();

  // GET /apps is the cross-project apps aggregator (kn-284).
  // Standalone addons belong on the project page, not the global apps list.
  const appsQuery = useQuery({
    queryKey: ['apps'],
    queryFn: () => appsApi.list(),
    refetchInterval: 15000,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => getAllProjects(),
  });

  if (!isAuthenticated) return null;

  const projectNames = new Map(
    (projectsQuery.data?.data ?? []).map((p) => [p.id, p.display_name ?? p.name]),
  );

  const allApps = appsQuery.data?.data ?? [];
  const apps = allApps.filter((app) => !STALE_PHASES.has(app.phase.toLowerCase()));
  const isLoading = appsQuery.isLoading;
  const hasAnything = apps.length > 0;

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
                  <TableHead>Project</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => {
                  const href = `/apps/${app.namespace}/${app.name}?project_id=${app.project_id}`;
                  const phaseKey = app.phase.toLowerCase();
                  return (
                    <TableRow
                      key={`${app.namespace}/${app.name}`}
                      className="cursor-pointer"
                      onClick={() => router.push(href)}
                    >
                      <TableCell>
                        <p className="font-medium text-zinc-900">{app.name}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-zinc-600">
                          {projectNames.get(app.project_id) ?? app.namespace}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                          {app.component_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[phaseKey] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDots[phaseKey] ?? 'bg-zinc-400'}`} />
                          {app.phase}
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
    </div>
  );
}
