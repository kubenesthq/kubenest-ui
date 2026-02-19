'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { addonInstancesApi } from '@/lib/api/addons';
import { AddonPhaseBadge } from './AddonPhaseBadge';
import type { AddonInstance, AddonType } from '@/types/api';

interface AddonInstanceListProps {
  projectId: string;
}

const typeEmoji: Record<AddonType, string> = {
  postgres: '🐘',
  redis: '🔴',
  kafka: '📨',
  mongodb: '🍃',
  mysql: '🐬',
  rabbitmq: '🐰',
  custom: '⚙️',
};

const typeBadgeClass: Record<AddonType, string> = {
  postgres: 'bg-blue-50 text-blue-700 border-blue-100',
  redis: 'bg-red-50 text-red-700 border-red-100',
  kafka: 'bg-purple-50 text-purple-700 border-purple-100',
  mongodb: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  mysql: 'bg-orange-50 text-orange-700 border-orange-100',
  rabbitmq: 'bg-amber-50 text-amber-700 border-amber-100',
  custom: 'bg-zinc-50 text-zinc-700 border-zinc-100',
};

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

export function AddonInstanceList({ projectId }: AddonInstanceListProps) {
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['addon-instances', projectId],
    queryFn: () => addonInstancesApi.list(projectId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-sm text-red-500">
        Failed to load addons: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const instances = data?.data ?? [];

  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-zinc-200 rounded-lg text-center">
        <p className="text-sm font-medium text-zinc-500 mb-1">No addons yet</p>
        <p className="text-xs text-zinc-400">Add one to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {instances.map((instance: AddonInstance, i: number) => (
        <motion.div
          key={instance.id}
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.3, delay: i * 0.05, ease: easeOutQuart }}
          className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors"
          onClick={() => router.push(`/projects/${projectId}/addons/${instance.id}`)}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg leading-none">{typeEmoji[instance.type] ?? '⚙️'}</span>
            <div>
              <p className="text-sm font-medium text-zinc-900">{instance.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${typeBadgeClass[instance.type] ?? typeBadgeClass.custom}`}
            >
              {instance.type}
            </span>
            <AddonPhaseBadge phase={instance.phase} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
