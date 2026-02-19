'use client';

import { Check, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhaseIndicatorProps {
  currentPhase: string;
  className?: string;
}

const phases = ['pending', 'building', 'deploying', 'running'] as const;

const phaseLabels: Record<string, string> = {
  pending: 'Pending',
  building: 'Building',
  deploying: 'Deploying',
  running: 'Running',
};

export function PhaseIndicator({ currentPhase, className }: PhaseIndicatorProps) {
  const phaseOrder: Record<string, number> = {
    pending: 0,
    building: 1,
    deploying: 2,
    running: 3,
    failed: -1,
    degraded: 3,
  };

  const normalizedPhase = currentPhase.toLowerCase();
  const currentIndex = phaseOrder[normalizedPhase] ?? 0;
  const isFailed = normalizedPhase === 'failed';
  const isDegraded = normalizedPhase === 'degraded';
  const isRunning = normalizedPhase === 'running';

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="progressbar"
      aria-label="Deployment progress"
      aria-valuenow={currentIndex}
      aria-valuemin={0}
      aria-valuemax={phases.length - 1}
      aria-valuetext={`Current phase: ${currentPhase}`}
    >
      {phases.map((phase, index) => {
        const isCompleted = index < currentIndex || (isDegraded && index === currentIndex) || (isRunning && index === currentIndex);
        const isCurrent = index === currentIndex && !isFailed && !isDegraded && !isRunning;
        const isPending = index > currentIndex;

        return (
          <div key={phase} className="flex items-center gap-2">
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

              <span
                className={cn('text-xs font-medium', {
                  'text-green-600': isCompleted,
                  'text-blue-600': isCurrent,
                  'text-red-600': isFailed && index === currentIndex,
                  'text-orange-600': isDegraded && index === currentIndex,
                  'text-gray-500': isPending,
                })}
              >
                {phaseLabels[phase]}
              </span>
            </div>

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
