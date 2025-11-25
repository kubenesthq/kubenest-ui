'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectStatusBadge } from '@/components/projects/ProjectStatusBadge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getProject, deleteProject } from '@/api/projects';
import { getCluster } from '@/api/clusters';

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });

  const project = projectData?.data;

  const { data: clusterData } = useQuery({
    queryKey: ['cluster', project?.cluster_id],
    queryFn: () => getCluster(project!.cluster_id),
    enabled: !!project?.cluster_id,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/projects');
    },
    onError: (error: Error) => {
      alert(`Failed to delete project: ${error.message}`);
      setIsDeleting(false);
      setShowDeleteDialog(false);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate(projectId);
  };

  if (projectLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Project not found
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cluster = clusterData?.data;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <ProjectStatusBadge status={project.status as any} />
          </div>
          <p className="text-muted-foreground mt-1">
            Created {format(new Date(project.created_at), 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/projects/${project.id}/workloads/new`}>
              Deploy Workload
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Project
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Name</div>
              <div className="text-lg font-semibold">{project.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Namespace</div>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {project.namespace}
              </code>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Cluster</div>
              <div className="text-sm">
                {cluster ? (
                  <Link
                    href={`/clusters/${cluster.id}`}
                    className="text-primary hover:underline"
                  >
                    {cluster.name}
                  </Link>
                ) : (
                  'Unknown'
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="mt-1">
                <ProjectStatusBadge status={project.status as any} />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Created</div>
              <div className="text-sm">
                {format(new Date(project.created_at), 'PPpp')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">No workloads deployed yet</p>
              <Button asChild size="sm">
                <Link href={`/projects/${project.id}/workloads/new`}>
                  Deploy First Workload
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
              <div className="flex-1">
                <div className="font-medium">Project created</div>
                <div className="text-muted-foreground text-xs">
                  {format(new Date(project.created_at), 'PPpp')}
                </div>
              </div>
            </div>
            {project.updated_at !== project.created_at && (
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                <div className="flex-1">
                  <div className="font-medium">Project updated</div>
                  <div className="text-muted-foreground text-xs">
                    {format(new Date(project.updated_at), 'PPpp')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{project.name}</strong>?
              This will delete the Kubernetes namespace and all resources within it.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
