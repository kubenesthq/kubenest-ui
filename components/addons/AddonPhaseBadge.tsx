import { Badge } from '@/components/ui/badge';
import type { AddonPhase } from '@/types/api';

interface AddonPhaseBadgeProps {
  phase: AddonPhase;
}

const phaseConfig: Record<AddonPhase, { className: string; label: string }> = {
  Running: {
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Running',
  },
  Deploying: {
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    label: 'Deploying',
  },
  Pending: {
    className: 'bg-zinc-50 text-zinc-600 border-zinc-200',
    label: 'Pending',
  },
  Degraded: {
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Degraded',
  },
  Failed: {
    className: 'bg-red-50 text-red-700 border-red-200',
    label: 'Failed',
  },
};

export function AddonPhaseBadge({ phase }: AddonPhaseBadgeProps) {
  const config = phaseConfig[phase] ?? phaseConfig.Pending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
      role="status"
      aria-label={`Addon phase: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
