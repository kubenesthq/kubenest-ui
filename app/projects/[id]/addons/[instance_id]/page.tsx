'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getProject } from '@/api/projects';
import { addonInstancesApi } from '@/lib/api/addons';
import { AddonPhaseBadge } from '@/components/addons/AddonPhaseBadge';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

const typeEmoji: Record<string, string> = {
  postgres: '🐘',
  redis: '🔴',
  kafka: '📨',
  mongodb: '🍃',
  mysql: '🐬',
  rabbitmq: '🐰',
  custom: '⚙️',
};

export default function AddonInstanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const instanceId = params.instance_id as string;
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: instance, isLoading } = useQuery({
    queryKey: ['addon-instance', instanceId],
    queryFn: () => addonInstancesApi.get(instanceId),
  });

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });
  const project = projectData;

  const deleteMutation = useMutation({
    mutationFn: () => addonInstancesApi.delete(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-instances', projectId] });
      router.push(`/projects/${projectId}`);
    },
    onError: (error: Error) => {
      alert(`Failed to delete addon: ${error.message}`);
      setShowDeleteDialog(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="px-8 py-8 max-w-5xl">
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-400">
            Addon instance not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const exports = instance.exports ? Object.entries(instance.exports) : [];

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: easeOutQuart }}
      >
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2"
        >
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            {project?.name ?? 'Project'}
          </Link>
        </Button>
      </motion.div>

      {/* Header */}
      <motion.div
        className="flex items-start justify-between"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl leading-none">{typeEmoji[instance.type] ?? '⚙️'}</span>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{instance.name}</h1>
            <AddonPhaseBadge phase={instance.phase} />
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Created {format(new Date(instance.created_at), 'MMMM d, yyyy')}
            {project && (
              <>
                {' · '}
                <Link href={`/projects/${projectId}`} className="text-blue-600 hover:underline">
                  {project.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete
        </Button>
      </motion.div>

      {/* Info card */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.12, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">Addon Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                label: 'Type',
                value: (
                  <span className="text-sm font-medium text-zinc-700 capitalize">{instance.type}</span>
                ),
              },
              {
                label: 'Phase',
                value: <AddonPhaseBadge phase={instance.phase} />,
              },
              ...(instance.definition_id
                ? [
                    {
                      label: 'Definition',
                      value: (
                        <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono">
                          {instance.definition_id}
                        </code>
                      ),
                    },
                  ]
                : []),
              {
                label: 'Created',
                value: (
                  <span className="text-sm text-zinc-700">
                    {format(new Date(instance.created_at), 'PPpp')}
                  </span>
                ),
              },
              ...(instance.deployed_at
                ? [
                    {
                      label: 'Deployed',
                      value: (
                        <span className="text-sm text-zinc-700">
                          {format(new Date(instance.deployed_at), 'PPpp')}
                        </span>
                      ),
                    },
                  ]
                : []),
              ...(instance.updated_at && instance.updated_at !== instance.created_at
                ? [
                    {
                      label: 'Last Updated',
                      value: (
                        <span className="text-sm text-zinc-700">
                          {format(new Date(instance.updated_at), 'PPpp')}
                        </span>
                      ),
                    },
                  ]
                : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">
                  {label}
                </p>
                {value}
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Exports card — only shown when Running */}
      {instance.phase === 'Running' && exports.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.2, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Connection Details
              </CardTitle>
              <p className="text-sm text-zinc-500">
                Use these connection strings in your workloads
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {exports.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-100"
                  >
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide shrink-0 mt-0.5">
                      {key}
                    </span>
                    <code className="text-xs font-mono text-zinc-700 break-all text-right">
                      {value}
                    </code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Status Events */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.28, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">Status Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div>
                  <p className="font-medium text-zinc-900">Addon created</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {format(new Date(instance.created_at), 'PPpp')}
                  </p>
                </div>
              </div>
              {instance.deployed_at && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-zinc-900">Addon deployed</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {format(new Date(instance.deployed_at), 'PPpp')}
                    </p>
                  </div>
                </div>
              )}
              {instance.phase === 'Running' && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-zinc-900">Addon running</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Connection details available above
                    </p>
                  </div>
                </div>
              )}
              {instance.phase === 'Failed' && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-zinc-900">Addon failed</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Check operator logs for details</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Addon</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{instance.name}</strong>? This will remove the
              addon from Kubernetes and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Addon'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
