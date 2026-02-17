'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateWorkload } from '@/hooks/useWorkloads';
import { WORKLOAD_LIMITS } from '@/lib/constants/workloads';
import type { CreateWorkloadRequest } from '@/types/api';

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
}).refine(
  (data) => !data.enabled || (data.host && data.host.length > 0),
  { message: 'Host is required when ingress is enabled', path: ['host'] }
);

// Validation schema matching the requirements
const workloadSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with dashes only'),
  image: z.string().min(1, 'Container image is required'),
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
});

type WorkloadFormData = z.infer<typeof workloadSchema>;

export default function NewWorkloadPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [showIngress, setShowIngress] = useState(false);

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
    },
  });

  const { fields: annotationFields, append: addAnnotation, remove: removeAnnotation } = useFieldArray({
    control,
    name: 'ingress.annotations',
  });

  const ingressEnabled = watch('ingress.enabled');

  const createWorkloadMutation = useCreateWorkload(projectId);

  const onSubmit = async (data: WorkloadFormData) => {
    try {
      const payload: WorkloadFormPayload = {
        name: data.name,
        image: data.image,
        replicas: data.replicas,
      };

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
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Deploy New Workload</h1>
          <p className="text-muted-foreground mt-2">
            Deploy a containerized application to your project
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Workload Configuration</CardTitle>
            <CardDescription>
              Configure your workload with a container image and deployment settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

              {/* Image Field */}
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
                    valueAsNumber: true,
                    setValueAs: (v) => v === '' || isNaN(v) ? undefined : Number(v)
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
              <div className="border rounded-lg">
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
                            Host <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="ingress-host"
                            placeholder="app.example.com"
                            {...register('ingress.host')}
                            disabled={isSubmitting}
                          />
                          {errors.ingress?.host && (
                            <p className="text-sm text-destructive">{errors.ingress.host.message}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Hostname for the ingress rule
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
                <div className="rounded-md bg-destructive/15 p-3">
                  <p className="text-sm text-destructive">{errors.root.message}</p>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
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
      </div>
    </div>
  );
}
