'use client';

import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateWorkload } from '@/hooks/useWorkloads';
import { WORKLOAD_LIMITS } from '@/lib/constants/workloads';
import type { CreateWorkloadRequest } from '@/types/api';

type WorkloadFormPayload = Omit<CreateWorkloadRequest, 'project_id'>;

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
});

type WorkloadFormData = z.infer<typeof workloadSchema>;

export default function NewWorkloadPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<WorkloadFormData>({
    resolver: zodResolver(workloadSchema),
    defaultValues: {
      name: '',
      image: '',
      replicas: 1,
      port: undefined,
    },
  });

  const createWorkloadMutation = useCreateWorkload(projectId);

  const onSubmit = async (data: WorkloadFormData) => {
    try {
      // Prepare the request payload (project_id is added by the hook)
      const payload: WorkloadFormPayload = {
        name: data.name,
        image: data.image,
        replicas: data.replicas,
      };

      // Only include port if provided
      if (data.port) {
        payload.port = data.port;
      }

      const response = await createWorkloadMutation.mutateAsync(payload);

      // Navigate to the workload detail page on success
      router.push(`/workloads/${response.id}`);
    } catch (error) {
      // Handle API errors
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
