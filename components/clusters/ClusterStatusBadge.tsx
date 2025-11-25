'use client';

import { Badge } from '@/components/ui/badge';
import type { ConnectionStatus } from '@/types/api';

interface ClusterStatusBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

export function ClusterStatusBadge({ status, className }: ClusterStatusBadgeProps) {
  const config = {
    connected: {
      variant: 'success' as const,
      label: 'Connected',
    },
    disconnected: {
      variant: 'destructive' as const,
      label: 'Disconnected',
    },
    pending: {
      variant: 'warning' as const,
      label: 'Pending',
    },
  };

  const { variant, label } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
