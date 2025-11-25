import { Badge } from '@/components/ui/badge';
import type { Workload } from '@/types/api';

type WorkloadPhase = Workload['phase'];

interface WorkloadStatusBadgeProps {
  phase: WorkloadPhase;
}

export function WorkloadStatusBadge({ phase }: WorkloadStatusBadgeProps) {
  const variants: Record<WorkloadPhase, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    Pending: { variant: 'outline', label: 'Pending' },
    Deploying: { variant: 'secondary', label: 'Deploying' },
    Running: { variant: 'default', label: 'Running' },
    Failed: { variant: 'destructive', label: 'Failed' },
    Degraded: { variant: 'outline', label: 'Degraded' },
  };

  const config = variants[phase] || variants.Pending;

  return (
    <Badge variant={config.variant} className="capitalize">
      {config.label}
    </Badge>
  );
}
