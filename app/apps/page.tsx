'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Database, Container, Trash2, Plus, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import {
  getAllDemoWorkloads, deleteDemoWorkload,
  getDemoDeployedStacks, deleteDemoDeployedStack,
  getDemoProjects,
  type DemoWorkload, type DemoDeployedStack,
} from '@/lib/demo-store';

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
  const [workloads, setWorkloads] = useState<DemoWorkload[]>([]);
  const [stacks, setStacks] = useState<DemoDeployedStack[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});

  const reload = () => {
    setWorkloads(getAllDemoWorkloads());
    setStacks(getDemoDeployedStacks());
    // Build project name map
    const projects = getDemoProjects();
    const names: Record<string, string> = {};
    projects.forEach(p => { names[p.id] = p.name; });
    setProjectNames(names);
  };

  useEffect(() => { reload(); }, []);

  const handleDeleteWorkload = (id: string) => {
    deleteDemoWorkload(id);
    reload();
  };

  const handleDeleteStack = (id: string) => {
    deleteDemoDeployedStack(id);
    reload();
  };

  if (!isAuthenticated) return null;

  const hasWorkloads = workloads.length > 0;
  const hasStacks = stacks.length > 0;
  const hasAnything = hasWorkloads || hasStacks;

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Apps</h1>
          <p className="text-sm text-zinc-500 mt-0.5">All deployed workloads and stacks across your projects.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/settings/stack-templates')}>
            Deploy from Template
          </Button>
        </div>
      </div>

      {!hasAnything ? (
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
          {/* Workloads */}
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
                      <TableHead>Addons</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workloads.map((w) => (
                      <TableRow
                        key={w.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/demo-workloads/${w.id}`)}
                      >
                        <TableCell>
                          <p className="font-medium text-zinc-900">{w.name}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {w.source_type === 'image' ? (
                              <Container className="h-3.5 w-3.5 text-zinc-400" />
                            ) : (
                              <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
                            )}
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {w.source_type === 'image' ? w.image : w.git_repo}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-zinc-600">
                            {projectNames[w.project_id] || w.project_id.slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {w.addons.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {w.addons.map((a) => (
                                <Badge key={a.id} variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                                  <Database className="h-3 w-3 mr-1" />
                                  {a.addon_name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[w.phase] ?? ''}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDots[w.phase] ?? ''}`} />
                            {w.phase}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-red-500"
                            onClick={(e) => { e.stopPropagation(); handleDeleteWorkload(w.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Deployed Stacks */}
          {hasStacks && (
            <Card className="border-zinc-200">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Stacks</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stack</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Components</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deployed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stacks.map((stack) => (
                      <TableRow
                        key={stack.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/apps/stacks/${stack.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-zinc-900">{stack.name}</p>
                            <p className="text-xs text-zinc-400 font-mono">{stack.workload_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-zinc-600">{stack.template_name}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {stack.image && (
                              <Badge variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                                <Container className="h-3 w-3 mr-1" />
                                {stack.image.split(':')[0].split('/').pop()}
                              </Badge>
                            )}
                            {stack.addons.map((addon) => (
                              <Badge key={addon} variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                                <Database className="h-3 w-3 mr-1" />
                                {addon}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[stack.status] ?? ''}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDots[stack.status] ?? ''}`} />
                            {stack.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-zinc-500">{new Date(stack.created_at).toLocaleDateString()}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-red-500"
                            onClick={(e) => { e.stopPropagation(); handleDeleteStack(stack.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
