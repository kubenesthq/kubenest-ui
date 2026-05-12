'use client';

import { useParams } from 'next/navigation';
import { CloudProviderDetail } from '@/components/providers/CloudProviderDetail';
import { useAuth } from '@/hooks/useAuth';

export default function CloudProviderDetailPage() {
  const params = useParams();
  const providerId = (params.provider as string) ?? '';
  const { isAuthenticated } = useAuth(true);
  if (!isAuthenticated) return null;
  return <CloudProviderDetail providerId={providerId} />;
}
