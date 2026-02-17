import { Badge } from '@/components/ui/badge';

interface WorkloadStatusBadgeProps {
  phase: string;
}

const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending: { variant: 'outline', label: 'Pending' },
  building: { variant: 'secondary', label: 'Building' },
  deploying: { variant: 'secondary', label: 'Deploying' },
  running: { variant: 'default', label: 'Running' },
  failed: { variant: 'destructive', label: 'Failed' },
  degraded: { variant: 'outline', label: 'Degraded' },
};

const defaultVariant = { variant: 'outline' as const, label: 'Unknown' };

export function WorkloadStatusBadge({ phase }: WorkloadStatusBadgeProps) {
  const config = variants[phase.toLowerCase()] || defaultVariant;

  return (
    <Badge
      variant={config.variant}
      className="capitalize"
      role="status"
      aria-label={`Workload status: ${config.label}`}
    >
      {config.label}
    </Badge>
  );
}
