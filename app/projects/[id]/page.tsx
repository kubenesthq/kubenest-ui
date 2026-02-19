'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge } from '@/components/projects/ProjectStatusBadge';
import { WorkloadList } from '@/components/workloads/WorkloadList';
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

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

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

  const project = projectData;

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
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="px-8 py-8 max-w-5xl">
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-400">
            Project not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const cluster = clusterData;

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      {/* Breadcrumb */}
      {cluster && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.3, ease: easeOutQuart }}
        >
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2"
          >
            <Link href={`/clusters/${cluster.id}`}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              {cluster.name}
            </Link>
          </Button>
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        className="flex items-start justify-between"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{project.name}</h1>
            <ProjectStatusBadge status={project.status as any} />
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Created {format(new Date(project.created_at), 'MMMM d, yyyy')}
            {cluster && (
              <>
                {' · '}
                <Link
                  href={`/clusters/${cluster.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {cluster.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href={`/projects/${project.id}/workloads/new`}>Deploy Workload</Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete
          </Button>
        </div>
      </motion.div>

      {/* Workloads — primary content */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.15, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-zinc-900">Workloads</CardTitle>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Deployments running in this project
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={`/projects/${project.id}/workloads/new`}>Deploy</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <WorkloadList projectId={project.id} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Metadata + Events */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.22, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: 'Namespace',
                  value: (
                    <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono">
                      {project.namespace}
                    </code>
                  ),
                },
                {
                  label: 'Cluster',
                  value: cluster ? (
                    <Link
                      href={`/clusters/${cluster.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {cluster.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-zinc-400">Unknown</span>
                  ),
                },
                {
                  label: 'Status',
                  value: <ProjectStatusBadge status={project.status as any} />,
                },
                {
                  label: 'Created',
                  value: (
                    <span className="text-sm text-zinc-700">
                      {format(new Date(project.created_at), 'PPpp')}
                    </span>
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">
                    {label}
                  </p>
                  {value}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.28, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Status Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-zinc-900">Project created</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {format(new Date(project.created_at), 'PPpp')}
                    </p>
                  </div>
                </div>
                {project.updated_at && project.updated_at !== project.created_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium text-zinc-900">Project updated</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {format(new Date(project.updated_at), 'PPpp')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{project.name}</strong>? This will delete the
              Kubernetes namespace and all resources within it. This action cannot be undone.
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
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
