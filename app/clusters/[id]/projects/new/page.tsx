'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField } from '@/components/ui/form';
import { getCluster } from '@/api/clusters';
import { createProject } from '@/api/projects';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

const createProjectSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(63, 'Name must be at most 63 characters')
    .regex(/^[a-zA-Z0-9-]+$/, 'Name can only contain letters, numbers, and hyphens'),
  description: z.string().optional(),
  registry_secret: z.string()
    .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 'Must be a valid Kubernetes name (lowercase alphanumeric and hyphens)')
    .optional()
    .or(z.literal('')),
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
      registry_secret: '',
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
      ...(data.description && { description: data.description }),
      ...(data.registry_secret && { registry_secret: data.registry_secret }),
    });
  };

  if (clusterLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const cluster = clusterData;

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
          <Link href={`/clusters/${clusterId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            {cluster?.name ?? 'Cluster'}
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Create New Project</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Deploy and manage workloads in this project
        </p>
      </motion.div>

      <div className="space-y-6">
        {/* Project Details Card */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.12, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
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

                <FormField
                  label="Registry Secret"
                  error={form.formState.errors.registry_secret?.message}
                >
                  <Input
                    {...form.register('registry_secret')}
                    placeholder="my-registry-secret"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Kubernetes secret name for pulling images from a private registry
                  </p>
                </FormField>

                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/clusters/${clusterId}`)}
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
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.18, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
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
        </motion.div>
      </div>
    </div>
  );
}
