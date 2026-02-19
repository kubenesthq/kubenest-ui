'use client';

import { useRouter } from 'next/navigation';
import { Plus, Server, FolderKanban, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClusterList } from '@/components/clusters/ClusterList';
import { useClusters } from '@/hooks/useClusters';
import { useAuth } from '@/hooks/useAuth';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth(true);
  const { data: clustersData } = useClusters();

  if (!isAuthenticated) {
    return null;
  }

  const clusters = clustersData?.data || [];
  const totalClusters = clusters.length;
  const totalProjects = clusters.reduce((acc, cluster) => acc + (cluster.node_count || 0), 0);
  const totalWorkloads = clusters.filter(c => c.status === 'connected').length;

  const stats = [
    {
      title: 'Total Clusters',
      value: totalClusters,
      subtitle: `${clusters.filter(c => c.status === 'connected').length} connected`,
      icon: Server,
    },
    {
      title: 'Projects',
      value: totalProjects,
      subtitle: 'Across all clusters',
      icon: FolderKanban,
    },
    {
      title: 'Workloads',
      value: totalWorkloads,
      subtitle: 'Active deployments',
      icon: Package,
    },
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, ease: easeOutQuart }}
      >
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
      </motion.div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{
              duration: 0.4,
              delay: 0.1 + index * 0.08,
              ease: easeOutQuart,
            }}
          >
            <Card className="transition-shadow duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Clusters List */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.35, ease: easeOutQuart }}
      >
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
      </motion.div>
    </div>
  );
}
