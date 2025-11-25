'use client';

import { Check, Loader2, Circle } from 'lucide-react';
import type { Workload } from '@/types/api';
import { cn } from '@/lib/utils';

interface PhaseIndicatorProps {
  currentPhase: Workload['phase'];
  className?: string;
}

type Phase = 'Pending' | 'Building' | 'Deploying' | 'Running';

const phases: Phase[] = ['Pending', 'Building', 'Deploying', 'Running'];

export function PhaseIndicator({ currentPhase, className }: PhaseIndicatorProps) {
  // Map phases to order index
  const phaseOrder: Record<string, number> = {
    Pending: 0,
    Building: 1,
    Deploying: 2,
    Running: 3,
    Failed: -1, // Special case
    Degraded: 3, // Show as partially complete
  };

  const currentIndex = phaseOrder[currentPhase] ?? 0;
  const isFailed = currentPhase === 'Failed';
  const isDegraded = currentPhase === 'Degraded';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {phases.map((phase, index) => {
        const isCompleted = index < currentIndex || (isDegraded && index === currentIndex);
        const isCurrent = index === currentIndex && !isFailed && !isDegraded;
        const isPending = index > currentIndex;

        return (
          <div key={phase} className="flex items-center gap-2">
            {/* Phase circle */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  {
                    'border-green-500 bg-green-500 text-white': isCompleted,
                    'border-blue-500 bg-blue-50 text-blue-600': isCurrent,
                    'border-red-500 bg-red-50 text-red-600': isFailed && index === currentIndex,
                    'border-orange-500 bg-orange-50 text-orange-600': isDegraded && index === currentIndex,
                    'border-gray-300 bg-gray-50 text-gray-400': isPending,
                  }
                )}
              >
                {isCompleted && <Check className="h-4 w-4" />}
                {isCurrent && <Loader2 className="h-4 w-4 animate-spin" />}
                {isFailed && index === currentIndex && <Circle className="h-4 w-4" />}
                {isDegraded && index === currentIndex && <Check className="h-4 w-4" />}
                {isPending && <Circle className="h-4 w-4" />}
              </div>

              {/* Phase label */}
              <span
                className={cn('text-xs font-medium', {
                  'text-green-600': isCompleted,
                  'text-blue-600': isCurrent,
                  'text-red-600': isFailed && index === currentIndex,
                  'text-orange-600': isDegraded && index === currentIndex,
                  'text-gray-500': isPending,
                })}
              >
                {phase}
              </span>
            </div>

            {/* Connector line */}
            {index < phases.length - 1 && (
              <div
                className={cn('h-0.5 w-12 transition-all', {
                  'bg-green-500': isCompleted,
                  'bg-gray-300': !isCompleted,
                })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
