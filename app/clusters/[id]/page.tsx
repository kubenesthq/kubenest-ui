'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Trash2, ArrowLeft, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ClusterStatusBadge } from '@/components/clusters/ClusterStatusBadge';
import { useCluster, useClusterProjects, useDeleteCluster } from '@/hooks/useClusters';
import { useAuth } from '@/hooks/useAuth';
import {
  getDemoCluster, getDemoProjects, deleteDemoCluster,
  type DemoCluster, type DemoProject,
} from '@/lib/demo-store';

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

  // Try demo cluster first
  const [demoCluster, setDemoCluster] = useState<DemoCluster | null>(null);
  const [demoProjects, setDemoProjects] = useState<DemoProject[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const dc = getDemoCluster(clusterId);
    if (dc) {
      setDemoCluster(dc);
      setDemoProjects(getDemoProjects(clusterId));
      setIsDemo(true);
    }
  }, [clusterId]);

  // API cluster (only if not demo)
  const { data: apiCluster, isLoading, error } = useCluster(clusterId);
  const { data: apiProjectsData } = useClusterProjects(clusterId);
  const deleteClusterMutation = useDeleteCluster();

  const handleDelete = async () => {
    if (isDemo) {
      deleteDemoCluster(clusterId);
      router.push('/dashboard');
    } else {
      try {
        await deleteClusterMutation.mutateAsync(clusterId);
        router.push('/dashboard');
      } catch (error) {
        console.error('Failed to delete cluster:', error);
      }
    }
  };

  if (!isAuthenticated) return null;

  // Resolve cluster data
  const cluster = isDemo ? demoCluster : apiCluster;
  const projects = isDemo ? demoProjects : (apiProjectsData?.data || []);

  if (!isDemo && isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!cluster) {
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

  const connectionStatus = cluster.status === 'connected' ? 'connected' as const
    : cluster.status === 'pending' ? 'pending' as const
    : 'disconnected' as const;

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
          <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 text-zinc-400 hover:text-zinc-600" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{cluster.name}</h1>
            {cluster.description && <p className="text-sm text-zinc-500 mt-1">{cluster.description}</p>}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </Button>
      </motion.div>

      {/* Status Card */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}>
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">Cluster Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">Connection</p>
                <ClusterStatusBadge status={connectionStatus} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">Health</p>
                <span className="text-sm font-medium text-zinc-900 capitalize">{cluster.status}</span>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">Nodes</p>
                <span className="text-sm font-medium text-zinc-900">{cluster.node_count || 0}</span>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">Kubernetes Version</p>
                <span className="text-sm font-medium text-zinc-900">{cluster.kubernetes_version || 'Unknown'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Projects Card */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ duration: 0.4, delay: 0.2, ease: easeOutQuart }}>
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-zinc-900">Projects</CardTitle>
                <CardDescription className="text-sm text-zinc-500 mt-0.5">Namespaces running in this cluster</CardDescription>
              </div>
              <Button asChild size="sm">
                <a href={`/clusters/${clusterId}/projects/new`}>
                  <Plus className="mr-2 h-3.5 w-3.5" /> New Project
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center">
                <p className="text-sm text-zinc-400">No projects yet. Create your first project to deploy workloads.</p>
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
                      <p className="text-sm font-medium text-zinc-900">{project.name}</p>
                      <p className="text-xs text-zinc-400">{project.namespace}</p>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 capitalize">{project.status}</span>
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
              Are you sure you want to delete <strong>{cluster.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
