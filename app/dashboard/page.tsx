'use client';

import { useRouter } from 'next/navigation';
import { Plus, Server, FolderKanban, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClusterList } from '@/components/clusters/ClusterList';
import { useClusters } from '@/hooks/useClusters';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth(true);
  const { data: clustersData } = useClusters();

  if (!isAuthenticated) {
    return null;
  }

  const clusters = clustersData?.data || [];
  const totalClusters = clusters.length;

  // Calculate stats - in a real app, these would come from separate API calls
  const totalProjects = clusters.reduce((acc, cluster) => acc + (cluster.node_count || 0), 0);
  const totalWorkloads = clusters.filter(c => c.status === 'connected').length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your Kubernetes clusters, projects, and workloads
          </p>
        </div>
        <Button onClick={() => router.push('/clusters/new')} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Register Cluster
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clusters</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClusters}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {clusters.filter(c => c.status === 'connected').length} connected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all clusters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workloads</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWorkloads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active deployments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clusters List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Clusters</CardTitle>
          <CardDescription>
            View and manage all your registered Kubernetes clusters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClusterList />
        </CardContent>
      </Card>
    </div>
  );
}
