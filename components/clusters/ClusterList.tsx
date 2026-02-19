'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClusterStatusBadge } from './ClusterStatusBadge';
import { clustersApi } from '@/lib/api/clusters';
import { getConnectionStatus } from '@/types/api';

const MotionTableRow = motion(TableRow);

export function ClusterList() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ['clusters'],
    queryFn: clustersApi.list,
    refetchInterval: 30000, // Refetch every 30 seconds to update connection status
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">
          Failed to load clusters: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const clusters = data?.data || [];

  if (clusters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          No clusters yet. Register your first cluster to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Connection</TableHead>
            <TableHead>Nodes</TableHead>
            <TableHead>Version</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clusters.map((cluster, index) => {
            const connectionStatus = getConnectionStatus(cluster);
            return (
              <MotionTableRow
                key={cluster.id}
                className="cursor-pointer"
                onClick={() => router.push(`/clusters/${cluster.id}`)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.06,
                  ease: [0.25, 1, 0.5, 1],
                }}
                whileHover={{ x: 4 }}
              >
                <TableCell>
                  <span className="font-medium">{cluster.name}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {cluster.description || '-'}
                </TableCell>
                <TableCell>
                  <span className="capitalize">{cluster.status}</span>
                </TableCell>
                <TableCell>
                  <ClusterStatusBadge status={connectionStatus} />
                </TableCell>
                <TableCell>{cluster.node_count || 0}</TableCell>
                <TableCell className="text-muted-foreground">
                  {cluster.kubernetes_version || '-'}
                </TableCell>
              </MotionTableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
