'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Trash2, Copy, ArrowLeft, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClusterStatusBadge } from '@/components/clusters/ClusterStatusBadge';
import { InstallCommandModal } from '@/components/clusters/InstallCommandModal';
import { useCluster, useClusterProjects, useDeleteCluster } from '@/hooks/useClusters';
import { clustersApi } from '@/lib/api/clusters';
import { getConnectionStatus } from '@/types/api';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

const slideInRow = (index: number) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.3, delay: index * 0.06, ease: easeOutQuart },
  whileHover: { x: 4 },
});

export default function ClusterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clusterId = params.id as string;
  const { isAuthenticated } = useAuth(true);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const { data: cluster, isLoading, error } = useCluster(clusterId);
  const { data: projectsData } = useClusterProjects(clusterId);
  const deleteClusterMutation = useDeleteCluster();
  const { data: installData } = useQuery({
    queryKey: ['clusters', clusterId, 'install-command'],
    queryFn: () => clustersApi.getInstallCommand(clusterId),
    enabled: !!cluster && cluster.status === 'pending',
  });

  const handleDelete = async () => {
    try {
      await deleteClusterMutation.mutateAsync(clusterId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to delete cluster:', error);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="px-8 py-8 max-w-5xl">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to load cluster: {error instanceof Error ? error.message : 'Not found'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const connectionStatus = getConnectionStatus(cluster);
  const projects = projectsData?.data || [];

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-start justify-between"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, ease: easeOutQuart }}
      >
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 text-zinc-400 hover:text-zinc-600"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{cluster.name}</h1>
            {cluster.description && (
              <p className="text-sm text-zinc-500 mt-1">{cluster.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {connectionStatus === 'pending' && (
            <Button variant="outline" size="sm" onClick={() => setShowInstallModal(true)}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Install Command
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteClusterMutation.isPending}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </motion.div>

      {/* Status Card */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">Cluster Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                {
                  label: 'Connection',
                  value: <ClusterStatusBadge status={connectionStatus} />,
                },
                {
                  label: 'Health',
                  value: (
                    <span className="text-sm font-medium text-zinc-900 capitalize">
                      {cluster.status}
                    </span>
                  ),
                },
                {
                  label: 'Nodes',
                  value: (
                    <span className="text-sm font-medium text-zinc-900">
                      {cluster.node_count || 0}
                    </span>
                  ),
                },
                {
                  label: 'Kubernetes Version',
                  value: (
                    <span className="text-sm font-medium text-zinc-900">
                      {cluster.kubernetes_version || 'Unknown'}
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
            </div>

            {connectionStatus === 'pending' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mt-2">
                <p className="text-sm font-medium text-amber-800">Cluster not connected yet</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Install the KubeNest operator in your cluster to establish connection.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => setShowInstallModal(true)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Get Install Command
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Projects Card */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.2, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-zinc-900">Projects</CardTitle>
                <CardDescription className="text-sm text-zinc-500 mt-0.5">
                  Namespaces running in this cluster
                </CardDescription>
              </div>
              <Button asChild size="sm">
                <a href={`/clusters/${clusterId}/projects/new`}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  New Project
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center">
                <p className="text-sm text-zinc-400">
                  No projects yet. Create your first project to deploy workloads.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {projects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    {...slideInRow(index)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {project.display_name || project.name}
                      </p>
                      <p className="text-xs text-zinc-400">{project.namespace}</p>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 capitalize">
                      {project.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cluster</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{cluster.name}</strong>? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteClusterMutation.isPending}
            >
              {deleteClusterMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Command Modal */}
      <InstallCommandModal
        open={showInstallModal}
        onOpenChange={setShowInstallModal}
        command={installData?.command || 'Loading...'}
        clusterName={cluster.name}
      />
    </div>
  );
}
