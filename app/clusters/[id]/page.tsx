'use client';

import { useParams } from 'next/navigation';
import { ClusterDetailView } from '@/components/clusters/ClusterDetailView';
import { useAuth } from '@/hooks/useAuth';

export default function ClusterDetailPage() {
  const params = useParams();
  const clusterId = params.id as string;
  const { isAuthenticated } = useAuth(true);
  if (!isAuthenticated) return null;
  return <ClusterDetailView clusterId={clusterId} />;
}
