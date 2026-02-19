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
  const connectedClusters = clusters.filter(c => c.status === 'connected').length;
  const totalNodes = clusters.reduce((acc, cluster) => acc + (cluster.node_count || 0), 0);
  const degradedClusters = clusters.filter(c => c.status === 'error' || c.status === 'disconnected').length;

  const stats = [
    {
      title: 'Clusters',
      value: totalClusters,
      subtitle: `${connectedClusters} of ${totalClusters} connected`,
      icon: Server,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      title: 'Total Nodes',
      value: totalNodes,
      subtitle: 'Across all clusters',
      icon: FolderKanban,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    {
      title: 'Needs Attention',
      value: degradedClusters,
      subtitle: degradedClusters === 0 ? 'All clusters healthy' : 'Disconnected or error',
      icon: Package,
      iconColor: degradedClusters > 0 ? 'text-red-500' : 'text-emerald-600',
      iconBg: degradedClusters > 0 ? 'bg-red-50' : 'bg-emerald-50',
    },
  ];

  return (
    <div className="px-8 py-8 space-y-8 max-w-5xl">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, ease: easeOutQuart }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Kubernetes infrastructure overview
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
            <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-zinc-200">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold tracking-tight text-zinc-900">{stat.value}</p>
                    <p className="text-xs text-zinc-400">{stat.subtitle}</p>
                  </div>
                  <div className={`rounded-lg p-2.5 ${stat.iconBg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                </div>
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
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-zinc-900">Your Clusters</CardTitle>
                <CardDescription className="text-sm text-zinc-500 mt-0.5">
                  Click a cluster to view details and manage projects
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ClusterList />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
