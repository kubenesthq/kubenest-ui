'use client';

import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type { ConnectionStatus } from '@/types/api';

interface ClusterStatusBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

type DotAnimation = { scale?: number[]; opacity: number[] };

const dotAnimations: Record<ConnectionStatus, DotAnimation | undefined> = {
  connected: { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] },
  pending: { opacity: [1, 0.35, 1] },
  disconnected: undefined,
};

const dotTransitions: Record<ConnectionStatus, Transition> = {
  connected: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  pending: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  disconnected: {},
};

export function ClusterStatusBadge({ status, className }: ClusterStatusBadgeProps) {
  const config = {
    connected: { variant: 'success' as const, label: 'Connected' },
    disconnected: { variant: 'destructive' as const, label: 'Disconnected' },
    pending: { variant: 'warning' as const, label: 'Pending' },
  };

  const { variant, label } = config[status];
  const dotAnim = dotAnimations[status];

  return (
    <Badge variant={variant} className={className}>
      <motion.span
        className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current"
        animate={dotAnim}
        transition={dotAnim ? dotTransitions[status] : undefined}
      />
      {label}
    </Badge>
  );
}
