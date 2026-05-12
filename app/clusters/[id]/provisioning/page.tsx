'use client';

import { useParams } from 'next/navigation';
import { ProvisioningStatusView } from '@/components/clusters/ProvisioningStatusView';
import { useAuth } from '@/hooks/useAuth';

export default function ProvisioningProgressPage() {
  const params = useParams();
  const clusterId = params.id as string;
  const { isAuthenticated } = useAuth(true);
  if (!isAuthenticated) return null;
  return <ProvisioningStatusView clusterId={clusterId} />;
}
