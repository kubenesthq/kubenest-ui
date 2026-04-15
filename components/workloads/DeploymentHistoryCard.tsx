'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { Check, Loader2, X, Clock, User, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkloadDeployments } from '@/hooks/useWorkloads';
import { cn } from '@/lib/utils';
import type { DeploymentRecord, DeploymentStatus } from '@/lib/api/workloads';

interface DeploymentHistoryCardProps {
  workloadId: string;
}

const statusStyles: Record<DeploymentStatus, { icon: typeof Check; color: string; label: string }> = {
  completed: { icon: Check, color: 'text-emerald-500 bg-emerald-50 border-emerald-200', label: 'Completed' },
  in_progress: { icon: Loader2, color: 'text-blue-500 bg-blue-50 border-blue-200', label: 'In progress' },
  pending: { icon: Clock, color: 'text-zinc-500 bg-zinc-50 border-zinc-200', label: 'Pending' },
  failed: { icon: X, color: 'text-red-500 bg-red-50 border-red-200', label: 'Failed' },
};

function DeploymentRow({ deployment }: { deployment: DeploymentRecord }) {
  const style = statusStyles[deployment.status];
  const Icon = style.icon;
  const TriggerIcon = deployment.triggered_by === 'user' ? User : Bot;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-100 last:border-0">
      <div
        className={cn(
          'mt-0.5 h-6 w-6 rounded-full border flex items-center justify-center shrink-0',
          style.color,
        )}
      >
        <Icon className={cn('h-3 w-3', deployment.status === 'in_progress' && 'animate-spin')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-900 break-words">{deployment.description}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
          <span title={format(new Date(deployment.created_at), 'PPpp')}>
            {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <TriggerIcon className="h-3 w-3" />
            {deployment.triggered_by === 'user' ? 'manual' : 'automated'}
          </span>
          <span>·</span>
          <span>{style.label}</span>
        </div>
        {deployment.error_message && (
          <p className="mt-1 text-xs text-red-600 font-mono break-words">{deployment.error_message}</p>
        )}
      </div>
    </div>
  );
}

export function DeploymentHistoryCard({ workloadId }: DeploymentHistoryCardProps) {
  const { data, isLoading, error } = useWorkloadDeployments(workloadId);

  return (
    <Card className="border-zinc-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-zinc-900 flex items-center justify-between">
          <span>Deployment History</span>
          {data && (
            <span className="text-xs font-normal text-zinc-400">
              {data.total_count} deployment{data.total_count === 1 ? '' : 's'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600">Failed to load deployment history.</p>
        )}
        {data && data.data.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-6">No deployments recorded yet.</p>
        )}
        {data && data.data.length > 0 && (
          <div className="divide-y divide-zinc-100">
            {data.data.map((deployment) => (
              <DeploymentRow key={deployment.id} deployment={deployment} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
