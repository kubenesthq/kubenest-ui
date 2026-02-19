'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateWorkload } from '@/hooks/useWorkloads';
import { getProject } from '@/api/projects';
import { getCluster } from '@/api/clusters';
import { WORKLOAD_LIMITS } from '@/lib/constants/workloads';
import type { CreateWorkloadRequest } from '@/types/api';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

type DeployMode = 'image' | 'chart';
type WorkloadFormPayload = Omit<CreateWorkloadRequest, 'project_id'>;

const annotationSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
});

const ingressSchema = z.object({
  enabled: z.boolean(),
  host: z.string().optional().nullable(),
  path: z.string().regex(/^\//, 'Path must start with /'),
  tls_secret: z.string().optional().nullable(),
  annotations: z.array(annotationSchema).optional(),
});

const chartSpecSchema = z.object({
  repo: z.string(),
  name: z.string(),
  version: z.string(),
});

const workloadSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with dashes only'),
  image: z.string().optional(),
  replicas: z
    .number()
    .int('Replicas must be an integer')
    .min(WORKLOAD_LIMITS.MIN_REPLICAS, `Replicas must be at least ${WORKLOAD_LIMITS.MIN_REPLICAS}`)
    .max(WORKLOAD_LIMITS.MAX_REPLICAS, `Replicas cannot exceed ${WORKLOAD_LIMITS.MAX_REPLICAS}`),
  port: z
    .number()
    .int('Port must be an integer')
    .min(WORKLOAD_LIMITS.MIN_PORT, `Port must be at least ${WORKLOAD_LIMITS.MIN_PORT}`)
    .max(WORKLOAD_LIMITS.MAX_PORT, `Port cannot exceed ${WORKLOAD_LIMITS.MAX_PORT}`)
    .optional()
    .nullable(),
  ingress: ingressSchema.optional(),
  chart: chartSpecSchema.optional(),
  valuesYaml: z.string().optional(),
});

type WorkloadFormData = z.infer<typeof workloadSchema>;

export default function NewWorkloadPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [showIngress, setShowIngress] = useState(false);
  const [showHelmValues, setShowHelmValues] = useState(false);
  const [deployMode, setDeployMode] = useState<DeployMode>('image');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });

  const { data: cluster } = useQuery({
    queryKey: ['cluster', project?.cluster_id],
    queryFn: () => getCluster(project!.cluster_id),
    enabled: !!project?.cluster_id,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<WorkloadFormData>({
    resolver: zodResolver(workloadSchema),
    defaultValues: {
      name: '',
      image: '',
      replicas: 1,
      port: undefined,
      ingress: {
        enabled: false,
        host: '',
        path: '/',
        tls_secret: '',
        annotations: [],
      },
      chart: {
        repo: '',
        name: '',
        version: '',
      },
      valuesYaml: '',
    },
  });

  const { fields: annotationFields, append: addAnnotation, remove: removeAnnotation } = useFieldArray({
    control,
    name: 'ingress.annotations',
  });

  const ingressEnabled = watch('ingress.enabled');
  const workloadName = watch('name');
  const autoHostname = (workloadName && project?.namespace && cluster?.base_domain)
    ? `${workloadName}.${project.namespace}.${cluster.base_domain}`
    : null;

  const createWorkloadMutation = useCreateWorkload(projectId);

  const onSubmit = async (data: WorkloadFormData) => {
    // Cross-validate based on deploy mode
    if (deployMode === 'image' && !data.image) {
      setError('image', { message: 'Container image is required' });
      return;
    }
    if (deployMode === 'chart') {
      if (!data.chart?.repo) {
        setError('chart.repo', { message: 'Repo URL is required' });
        return;
      }
      if (!data.chart?.name) {
        setError('chart.name', { message: 'Chart name is required' });
        return;
      }
      if (!data.chart?.version) {
        setError('chart.version', { message: 'Version is required' });
        return;
      }
    }

    try {
      const payload: WorkloadFormPayload = {
        name: data.name,
        replicas: data.replicas,
      };

      if (deployMode === 'image') {
        payload.image = data.image;
      } else {
        payload.chart = data.chart;
        if (data.valuesYaml?.trim()) {
          try {
            payload.values = JSON.parse(data.valuesYaml);
          } catch {
            setError('valuesYaml', { message: 'Invalid JSON — must be a valid JSON object' });
            return;
          }
        }
      }

      if (data.port) {
        payload.port = data.port;
      }

      if (data.ingress?.enabled) {
        const annotationsMap: Record<string, string> = {};
        data.ingress.annotations?.forEach((a) => {
          if (a.key && a.value) annotationsMap[a.key] = a.value;
        });

        payload.ingress = {
          enabled: true,
          host: data.ingress.host || null,
          path: data.ingress.path || '/',
          tls_secret: data.ingress.tls_secret || null,
          annotations: Object.keys(annotationsMap).length > 0 ? annotationsMap : null,
        };
      }

      const response = await createWorkloadMutation.mutateAsync(payload);
      router.push(`/workloads/${response.id}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to deploy workload';
      setError('root', {
        type: 'manual',
        message: errorMessage,
      });
    }
  };

  return (
    <div className="px-8 py-8 max-w-2xl space-y-6">
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
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Deploy New Workload</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Deploy a containerized application to your project
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.12, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Workload Configuration</CardTitle>
            <CardDescription>
              Configure your workload with a container image or Helm chart and deployment settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Deploy Mode Toggle */}
              <div className="space-y-2">
                <Label>Deploy Mode</Label>
                <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                  <button
                    type="button"
                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                      deployMode === 'image'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                    onClick={() => setDeployMode('image')}
                  >
                    Image
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors border-l border-zinc-200 ${
                      deployMode === 'chart'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                    onClick={() => setDeployMode('chart')}
                  >
                    Helm Chart
                  </button>
                </div>
              </div>

              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="api-server"
                  {...register('name')}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and dashes only
                </p>
              </div>

              {/* Image Field — shown in image mode */}
              {deployMode === 'image' && (
                <div className="space-y-2">
                  <Label htmlFor="image">
                    Container Image <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="image"
                    placeholder="nginx:1.21"
                    {...register('image')}
                    disabled={isSubmitting}
                  />
                  {errors.image && (
                    <p className="text-sm text-destructive">{errors.image.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Docker image name with optional tag (e.g., nginx:latest)
                  </p>
                </div>
              )}

              {/* Helm Chart Fields — shown in chart mode */}
              {deployMode === 'chart' && (
                <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
                  <p className="text-sm font-medium text-zinc-900">Helm Chart Source</p>

                  <div className="space-y-2">
                    <Label htmlFor="chart-repo">
                      Repository URL <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="chart-repo"
                      placeholder="https://charts.bitnami.com/bitnami"
                      {...register('chart.repo')}
                      disabled={isSubmitting}
                    />
                    {errors.chart?.repo && (
                      <p className="text-sm text-destructive">{errors.chart.repo.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="chart-name">
                        Chart Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="chart-name"
                        placeholder="postgresql"
                        {...register('chart.name')}
                        disabled={isSubmitting}
                      />
                      {errors.chart?.name && (
                        <p className="text-sm text-destructive">{errors.chart.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chart-version">
                        Version <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="chart-version"
                        placeholder="12.1.2"
                        {...register('chart.version')}
                        disabled={isSubmitting}
                      />
                      {errors.chart?.version && (
                        <p className="text-sm text-destructive">{errors.chart.version.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Helm Values — collapsible */}
                  <div className="border border-zinc-200 rounded-lg">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full p-3 text-left"
                      onClick={() => setShowHelmValues(!showHelmValues)}
                    >
                      <div>
                        <span className="text-sm font-medium">Helm Values</span>
                        <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                      </div>
                      {showHelmValues ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {showHelmValues && (
                      <div className="px-3 pb-3 space-y-2 border-t pt-3">
                        <Textarea
                          placeholder='{"replicaCount": 2, "service": {"type": "ClusterIP"}}'
                          rows={6}
                          className="font-mono text-xs"
                          {...register('valuesYaml')}
                          disabled={isSubmitting}
                        />
                        {errors.valuesYaml && (
                          <p className="text-sm text-destructive">{errors.valuesYaml.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          JSON object of Helm values to pass to the chart
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Replicas Field */}
              <div className="space-y-2">
                <Label htmlFor="replicas">
                  Replicas <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="replicas"
                  type="number"
                  min={WORKLOAD_LIMITS.MIN_REPLICAS}
                  max={WORKLOAD_LIMITS.MAX_REPLICAS}
                  {...register('replicas', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
                {errors.replicas && (
                  <p className="text-sm text-destructive">{errors.replicas.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Number of pod replicas ({WORKLOAD_LIMITS.MIN_REPLICAS}-{WORKLOAD_LIMITS.MAX_REPLICAS}, default: {WORKLOAD_LIMITS.DEFAULT_REPLICAS})
                </p>
              </div>

              {/* Port Field */}
              <div className="space-y-2">
                <Label htmlFor="port">Port (Optional)</Label>
                <Input
                  id="port"
                  type="number"
                  min={WORKLOAD_LIMITS.MIN_PORT}
                  max={WORKLOAD_LIMITS.MAX_PORT}
                  placeholder="8080"
                  {...register('port', {
                    setValueAs: (v) => (v === '' || v === null || v === undefined) ? undefined : Number(v)
                  })}
                  disabled={isSubmitting}
                />
                {errors.port && (
                  <p className="text-sm text-destructive">{errors.port.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Container port to expose ({WORKLOAD_LIMITS.MIN_PORT}-{WORKLOAD_LIMITS.MAX_PORT})
                </p>
              </div>

              {/* Ingress Section */}
              <div className="border border-zinc-200 rounded-lg">
                <button
                  type="button"
                  className="flex items-center justify-between w-full p-4 text-left"
                  onClick={() => setShowIngress(!showIngress)}
                >
                  <div>
                    <span className="font-medium">Ingress Configuration</span>
                    <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                  </div>
                  {showIngress ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {showIngress && (
                  <div className="px-4 pb-4 space-y-4 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="ingress-enabled"
                        {...register('ingress.enabled')}
                        disabled={isSubmitting}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="ingress-enabled">Enable Ingress</Label>
                    </div>

                    {ingressEnabled && (
                      <div className="space-y-4 pl-6">
                        <div className="space-y-2">
                          <Label htmlFor="ingress-host">
                            Host <span className="text-zinc-400 font-normal">(optional)</span>
                          </Label>
                          <Input
                            id="ingress-host"
                            placeholder={autoHostname ?? 'app.example.com'}
                            {...register('ingress.host')}
                            disabled={isSubmitting}
                          />
                          {errors.ingress?.host && (
                            <p className="text-sm text-destructive">{errors.ingress.host.message}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {autoHostname
                              ? <>Leave blank to auto-generate: <span className="font-mono">{autoHostname}</span></>
                              : 'Leave blank to auto-generate from cluster base domain'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ingress-path">Path</Label>
                          <Input
                            id="ingress-path"
                            placeholder="/"
                            {...register('ingress.path')}
                            disabled={isSubmitting}
                          />
                          {errors.ingress?.path && (
                            <p className="text-sm text-destructive">{errors.ingress.path.message}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            URL path prefix (defaults to /)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ingress-tls">TLS Secret (Optional)</Label>
                          <Input
                            id="ingress-tls"
                            placeholder="my-tls-secret"
                            {...register('ingress.tls_secret')}
                            disabled={isSubmitting}
                          />
                          <p className="text-xs text-muted-foreground">
                            Kubernetes TLS secret name for HTTPS
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Annotations (Optional)</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addAnnotation({ key: '', value: '' })}
                              disabled={isSubmitting}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                          {annotationFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2 items-start">
                              <div className="flex-1">
                                <Input
                                  placeholder="Key"
                                  {...register(`ingress.annotations.${index}.key`)}
                                  disabled={isSubmitting}
                                />
                                {errors.ingress?.annotations?.[index]?.key && (
                                  <p className="text-xs text-destructive mt-1">
                                    {errors.ingress.annotations[index].key?.message}
                                  </p>
                                )}
                              </div>
                              <div className="flex-1">
                                <Input
                                  placeholder="Value"
                                  {...register(`ingress.annotations.${index}.value`)}
                                  disabled={isSubmitting}
                                />
                                {errors.ingress?.annotations?.[index]?.value && (
                                  <p className="text-xs text-destructive mt-1">
                                    {errors.ingress.annotations[index].value?.message}
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAnnotation(index)}
                                disabled={isSubmitting}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errors.root && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-destructive">{errors.root.message}</p>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/projects/${projectId}`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Deploying...' : 'Deploy Workload'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
