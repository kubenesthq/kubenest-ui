'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import type { ProjectWithDetails } from '@/api/projects';

interface ProjectListProps {
  projects: ProjectWithDetails[];
  onDelete: (id: string) => void;
  isDeleting?: string;
}

export function ProjectList({ projects, onDelete, isDeleting }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No projects found. Create your first project to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Namespace</TableHead>
          <TableHead>Cluster</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Workloads</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell className="font-medium">
              <Link
                href={`/projects/${project.id}`}
                className="hover:underline"
              >
                {project.name}
              </Link>
            </TableCell>
            <TableCell>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {project.namespace}
              </code>
            </TableCell>
            <TableCell>{project.cluster_name || 'Unknown'}</TableCell>
            <TableCell>
              <ProjectStatusBadge status={project.status as any} />
            </TableCell>
            <TableCell className="text-right">
              {project.workloads_count ?? 0}
            </TableCell>
            <TableCell>
              {format(new Date(project.created_at), 'MMM d, yyyy')}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <Link href={`/projects/${project.id}`}>
                    View
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(project.id)}
                  disabled={isDeleting === project.id}
                >
                  {isDeleting === project.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
