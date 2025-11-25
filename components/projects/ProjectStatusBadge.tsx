import { Badge } from '@/components/ui/badge';

type ProjectStatus = 'pending' | 'creating' | 'active' | 'failed';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
}

const statusConfig: Record<ProjectStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  creating: { label: 'Creating', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
