'use client';

import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
          <TableRow
            key={workload.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/workloads/${workload.id}`)}
          >
            <TableCell className="font-medium">
              {workload.name}
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
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/workloads/${workload.id}`);
                }}
              >
                View
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
