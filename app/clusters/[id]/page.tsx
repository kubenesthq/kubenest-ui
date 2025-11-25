'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Trash2, Copy, ArrowLeft } from 'lucide-react';
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Failed to load cluster: {error instanceof Error ? error.message : 'Not found'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const connectionStatus = getConnectionStatus(cluster);
  const projects = projectsData?.items || [];
  const installCommand = clustersApi.getInstallCommand(cluster);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {cluster.display_name || cluster.name}
            </h1>
            <p className="text-muted-foreground mt-1">{cluster.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {connectionStatus === 'pending' && (
            <Button variant="outline" onClick={() => setShowInstallModal(true)}>
              <Copy className="mr-2 h-4 w-4" />
              Show Install Command
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteClusterMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Cluster Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Connection</p>
              <div className="mt-1">
                <ClusterStatusBadge status={connectionStatus} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Health</p>
              <p className="text-sm font-medium mt-1 capitalize">{cluster.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nodes</p>
              <p className="text-sm font-medium mt-1">{cluster.node_count || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kubernetes Version</p>
              <p className="text-sm font-medium mt-1">
                {cluster.kubernetes_version || 'Unknown'}
              </p>
            </div>
          </div>

          {connectionStatus === 'pending' && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-4">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Cluster not connected yet
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Install the Kubenest operator in your cluster to establish connection.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowInstallModal(true)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Get Install Command
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects Card */}
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            Projects (namespaces) running in this cluster
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No projects yet. Create your first project to deploy workloads.
            </p>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{project.display_name}</p>
                    <p className="text-sm text-muted-foreground">{project.name}</p>
                  </div>
                  <span className="text-sm capitalize">{project.phase}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cluster Information */}
      <Card>
        <CardHeader>
          <CardTitle>Cluster Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Cluster ID</p>
            <p className="text-sm font-mono mt-1">{cluster.id}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cluster Name</p>
            <p className="text-sm font-medium mt-1">{cluster.name}</p>
          </div>
          {cluster.operator_version && (
            <div>
              <p className="text-sm text-muted-foreground">Operator Version</p>
              <p className="text-sm font-medium mt-1">{cluster.operator_version}</p>
            </div>
          )}
          {cluster.last_heartbeat && (
            <div>
              <p className="text-sm text-muted-foreground">Last Heartbeat</p>
              <p className="text-sm font-medium mt-1">
                {new Date(cluster.last_heartbeat).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cluster</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{cluster.name}</strong>? This action
              cannot be undone.
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
        command={installCommand}
        clusterName={cluster.display_name || cluster.name}
      />
    </div>
  );
}
