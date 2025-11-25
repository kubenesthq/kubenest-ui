'use client';

import { Badge } from '@/components/ui/badge';
import type { Workload } from '@/types/api';

interface WorkloadStatusBadgeProps {
  phase: Workload['phase'];
  className?: string;
}

export function WorkloadStatusBadge({ phase, className }: WorkloadStatusBadgeProps) {
  const config = {
    Pending: {
      variant: 'secondary' as const,
      label: 'Pending',
    },
    Building: {
      variant: 'default' as const,
      label: 'Building',
    },
    Deploying: {
      variant: 'warning' as const,
      label: 'Deploying',
    },
    Running: {
      variant: 'success' as const,
      label: 'Running',
    },
    Failed: {
      variant: 'destructive' as const,
      label: 'Failed',
    },
    Degraded: {
      variant: 'warning' as const,
      label: 'Degraded',
    },
  };

  const { variant, label } = config[phase] || config.Pending;

  return (
    <Badge variant={variant} className={className}>
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
