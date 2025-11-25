'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { WorkloadStatusBadge } from './WorkloadStatusBadge';
import { useWorkloads } from '@/hooks/useWorkloads';
import type { Workload } from '@/types/api';

interface WorkloadListProps {
  projectId: string;
}

export function WorkloadList({ projectId }: WorkloadListProps) {
  const { data, isLoading, error } = useWorkloads(projectId);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading workloads...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load workloads: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const workloads = data?.data || [];

  if (workloads.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="mb-4">No workloads deployed yet</p>
        <Button asChild size="sm">
          <Link href={`/projects/${projectId}/workloads/new`}>
            Deploy First Workload
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Image</TableHead>
          <TableHead className="text-center">Replicas</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workloads.map((workload: Workload) => (
          <TableRow key={workload.id}>
            <TableCell className="font-medium">
              <Link
                href={`/workloads/${workload.id}`}
                className="hover:underline"
              >
                {workload.name}
              </Link>
            </TableCell>
            <TableCell>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {workload.image}
              </code>
            </TableCell>
            <TableCell className="text-center">
              {workload.replicas}
            </TableCell>
            <TableCell>
              <WorkloadStatusBadge phase={workload.phase} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                asChild
                variant="outline"
                size="sm"
              >
                <Link href={`/workloads/${workload.id}`}>
                  View
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
