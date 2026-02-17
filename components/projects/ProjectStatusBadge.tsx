import { Badge } from '@/components/ui/badge';

interface ProjectStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  creating: { label: 'Creating', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  ready: { label: 'Ready', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  error: { label: 'Error', variant: 'destructive' },
};

const defaultConfig = { label: 'Unknown', variant: 'secondary' as const };

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || defaultConfig;

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
