'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Minus, Plus, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkloadStatusBadge } from '@/components/workloads/WorkloadStatusBadge';
import { PhaseIndicator } from '@/components/workloads/PhaseIndicator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWorkload, useScaleWorkload, useDeleteWorkload } from '@/hooks/useWorkloads';
import { getProject } from '@/api/projects';
import { WORKLOAD_LIMITS } from '@/lib/constants/workloads';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

export default function WorkloadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workloadId = params.id as string;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [desiredReplicas, setDesiredReplicas] = useState<number>(1);
  const [isScaling, setIsScaling] = useState(false);
  const [showHelmValues, setShowHelmValues] = useState(false);

  // SSE disabled — backend SSE endpoint not yet stable
  const connected = false;
  const reconnecting = false;

  const { data: workload, isLoading: workloadLoading } = useWorkload(workloadId);

  useEffect(() => {
    if (workload) {
      setDesiredReplicas(workload.replicas);
    }
  }, [workload]);

  const { data: projectData } = useQuery({
    queryKey: ['project', workload?.project_id],
    queryFn: () => getProject(workload!.project_id),
    enabled: !!workload?.project_id,
  });
  const project = projectData;

  const scaleMutation = useScaleWorkload(workloadId);
  const deleteMutation = useDeleteWorkload();

  const handleScale = () => {
    if (desiredReplicas === workload?.replicas) return;
    setIsScaling(true);
    scaleMutation.mutate(desiredReplicas, {
      onSuccess: () => setIsScaling(false),
      onError: (error: Error) => {
        alert(`Failed to scale workload: ${error.message}`);
        setIsScaling(false);
        setDesiredReplicas(workload?.replicas || 1);
      },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(workloadId, {
      onSuccess: () => router.push(`/projects/${workload?.project_id}`),
      onError: (error: Error) => {
        alert(`Failed to delete workload: ${error.message}`);
        setShowDeleteDialog(false);
      },
    });
  };

  const incrementReplicas = () =>
    setDesiredReplicas((prev) => Math.min(prev + 1, WORKLOAD_LIMITS.MAX_REPLICAS));
  const decrementReplicas = () =>
    setDesiredReplicas((prev) => Math.max(prev - 1, WORKLOAD_LIMITS.MIN_REPLICAS));

  if (workloadLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!workload) {
    return (
      <div className="px-8 py-8 max-w-5xl">
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-400">
            Workload not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasReplicaChanges = desiredReplicas !== workload.replicas;

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      {/* Breadcrumb */}
      {project && (
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
            <Link href={`/projects/${project.id}`}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              {project.name}
            </Link>
          </Button>
        </motion.div>
      )}

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
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{workload.name}</h1>
            <WorkloadStatusBadge phase={workload.phase} />
            {/* SSE connection indicator */}
            {connected ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 text-xs font-medium">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                Live
              </div>
            ) : reconnecting ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-200 text-xs font-medium">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                Reconnecting...
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 text-zinc-400 rounded-md border border-zinc-200 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 inline-block" />
                Offline
              </div>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Created {format(new Date(workload.created_at), 'MMMM d, yyyy')}
            {project && (
              <>
                {' · '}
                <Link
                  href={`/projects/${project.id}`}
                  className="text-blue-600 hover:underline"
                >
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

      {/* Deployment Progress */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.12, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">
              Deployment Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhaseIndicator currentPhase={workload.phase} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Details + Scale Controls */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.18, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Workload Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                workload.chart_config?.chart
                  ? {
                      label: 'Helm Chart',
                      value: (
                        <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono block truncate">
                          {workload.chart_config.chart.name}@{workload.chart_config.chart.version}
                          <span className="text-zinc-400 ml-1">({workload.chart_config.chart.repo})</span>
                        </code>
                      ),
                    }
                  : {
                      label: 'Image',
                      value: (
                        <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono block truncate">
                          {workload.image}
                        </code>
                      ),
                    },
                {
                  label: 'Port',
                  value: (
                    <span className="text-sm text-zinc-700">
                      {workload.port || 'Not specified'}
                    </span>
                  ),
                },
                {
                  label: 'Status',
                  value: <WorkloadStatusBadge phase={workload.phase} />,
                },
                {
                  label: 'Replicas',
                  value: (
                    <span className="text-2xl font-bold tracking-tight text-zinc-900">
                      {workload.replicas}
                    </span>
                  ),
                },
                {
                  label: 'Created',
                  value: (
                    <span className="text-sm text-zinc-700">
                      {format(new Date(workload.created_at), 'PPpp')}
                    </span>
                  ),
                },
                ...(workload.updated_at
                  ? [
                      {
                        label: 'Last Updated',
                        value: (
                          <span className="text-sm text-zinc-700">
                            {format(new Date(workload.updated_at), 'PPpp')}
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

        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.22, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Scale Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-3">
                  Adjust Replicas
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decrementReplicas}
                    disabled={isScaling || desiredReplicas <= WORKLOAD_LIMITS.MIN_REPLICAS}
                    aria-label="Decrease replica count"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={WORKLOAD_LIMITS.MIN_REPLICAS}
                    max={WORKLOAD_LIMITS.MAX_REPLICAS}
                    value={desiredReplicas}
                    onChange={(e) =>
                      setDesiredReplicas(
                        Math.max(WORKLOAD_LIMITS.MIN_REPLICAS, parseInt(e.target.value) || 0)
                      )
                    }
                    disabled={isScaling}
                    className="w-24 text-center text-lg font-semibold"
                    aria-label="Number of replicas"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={incrementReplicas}
                    disabled={isScaling || desiredReplicas >= WORKLOAD_LIMITS.MAX_REPLICAS}
                    aria-label="Increase replica count"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 px-4 bg-zinc-50 rounded-lg border border-zinc-100">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1">
                    Current
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-zinc-900">
                    {workload.replicas}
                  </p>
                </div>
                <span className="text-zinc-300 text-xl">→</span>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1">
                    Desired
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-blue-600">
                    {desiredReplicas}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleScale}
                disabled={!hasReplicaChanges || isScaling}
                className="w-full"
              >
                {isScaling ? 'Scaling...' : 'Apply Scale Changes'}
              </Button>

              {hasReplicaChanges && !isScaling && (
                <p className="text-xs text-zinc-400 text-center">
                  Scale from {workload.replicas} → {desiredReplicas} replicas
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Ingress */}
      {workload.ingress_config?.enabled && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.28, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">Ingress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Host', value: workload.ingress_config.host },
                  { label: 'Path', value: workload.ingress_config.path },
                  {
                    label: 'TLS',
                    value: workload.ingress_config.tls_secret
                      ? `Enabled (${workload.ingress_config.tls_secret})`
                      : 'Not configured',
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">
                      {label}
                    </p>
                    <span className="text-sm text-zinc-700">{value}</span>
                  </div>
                ))}
                {workload.ingress_config.host && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">
                      External URL
                    </p>
                    <a
                      href={`${workload.ingress_config.tls_secret ? 'https' : 'http'}://${workload.ingress_config.host}${workload.ingress_config.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {workload.ingress_config.tls_secret ? 'https' : 'http'}://
                      {workload.ingress_config.host}
                      {workload.ingress_config.path}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
              {workload.ingress_config.annotations &&
                Object.keys(workload.ingress_config.annotations).length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-2">
                      Annotations
                    </p>
                    <div className="bg-zinc-100 rounded-md p-3 space-y-1">
                      {Object.entries(workload.ingress_config.annotations).map(([key, value]) => (
                        <div key={key} className="text-xs font-mono text-zinc-600">
                          <span className="text-zinc-400">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Helm Values */}
      {workload.chart_config?.values && Object.keys(workload.chart_config.values).length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.30, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <button
              type="button"
              className="flex items-center justify-between w-full px-6 py-4 text-left"
              onClick={() => setShowHelmValues(!showHelmValues)}
            >
              <CardTitle className="text-base font-semibold text-zinc-900">Helm Values</CardTitle>
              {showHelmValues ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showHelmValues && (
              <CardContent className="pt-0">
                <pre className="bg-zinc-50 border border-zinc-100 rounded-md p-3 text-xs font-mono text-zinc-700 overflow-x-auto">
                  {JSON.stringify(workload.chart_config.values, null, 2)}
                </pre>
              </CardContent>
            )}
          </Card>
        </motion.div>
      )}

      {/* Status Events */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.32, ease: easeOutQuart }}
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
                  <p className="font-medium text-zinc-900">Workload created</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {format(new Date(workload.created_at), 'PPpp')}
                  </p>
                </div>
              </div>
              {workload.updated_at && workload.updated_at !== workload.created_at && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-zinc-900">Workload updated</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {format(new Date(workload.updated_at), 'PPpp')}
                    </p>
                  </div>
                </div>
              )}
              {workload.phase === 'running' && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-zinc-900">Deployment successful</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Running with {workload.replicas} replica(s)
                    </p>
                  </div>
                </div>
              )}
              {workload.phase === 'failed' && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-zinc-900">Deployment failed</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Check operator logs for details
                    </p>
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
            <DialogTitle>Delete Workload</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{workload.name}</strong>? This will remove
              the workload from Kubernetes and cannot be undone.
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
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Workload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
