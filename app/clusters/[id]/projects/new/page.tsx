'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormField } from '@/components/ui/form';
import { NamespacePreview } from '@/components/projects/NamespacePreview';
import { getCluster } from '@/api/clusters';
import { createProject } from '@/api/projects';

const createProjectSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(63, 'Name must be at most 63 characters')
    .regex(/^[a-zA-Z0-9-]+$/, 'Name can only contain letters, numbers, and hyphens'),
  description: z.string().optional(),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

export default function NewProjectPage() {
  const router = useRouter();
  const params = useParams();
  const clusterId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: clusterData, isLoading: clusterLoading } = useQuery({
    queryKey: ['cluster', clusterId],
    queryFn: () => getCluster(clusterId),
  });

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (response) => {
      router.push(`/projects/${response.id}`);
    },
    onError: (error: Error) => {
      alert(`Failed to create project: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: CreateProjectFormData) => {
    setIsSubmitting(true);
    createMutation.mutate({
      name: data.name,
      cluster_id: clusterId,
    });
  };

  const projectName = form.watch('name');

  if (clusterLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading cluster...</div>
      </div>
    );
  }

  const cluster = clusterData;

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create New Project</h1>
        <p className="text-muted-foreground mt-1">
          Create a new project in <span className="font-semibold">{cluster?.name || 'cluster'}</span>
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Enter the details for your new Kubernetes project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                label="Project Name"
                error={form.formState.errors.name?.message}
                required
              >
                <Input
                  {...form.register('name')}
                  placeholder="my-project"
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField
                label="Description"
                error={form.formState.errors.description?.message}
              >
                <Input
                  {...form.register('description')}
                  placeholder="Optional project description"
                  disabled={isSubmitting}
                />
              </FormField>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>

        {projectName && <NamespacePreview projectName={projectName} />}

        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-sm">Guardrails Configuration</CardTitle>
            <CardDescription className="text-xs">
              Advanced configuration (optional)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Guardrails configuration will be available in a future update.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
