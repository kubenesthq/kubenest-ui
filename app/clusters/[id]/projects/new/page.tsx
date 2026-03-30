'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField } from '@/components/ui/form';
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
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

export default function NewProjectPage() {
  const router = useRouter();
  const params = useParams();
  const clusterId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (data: CreateProjectFormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const project = await createProject({
        cluster_id: clusterId,
        name: data.name,
        description: data.description,
      });
      setProjectName(data.name);
      setCreated(true);
      setTimeout(() => {
        router.push(`/projects/${project.id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setIsSubmitting(false);
    }
  };

  if (created) {
    return (
      <div className="px-8 py-8 max-w-2xl flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: easeOutQuart }}
          className="text-center space-y-4"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Project Created</h2>
          <p className="text-zinc-500">
            <span className="font-mono text-zinc-700">{projectName}</span> is ready for workloads.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-2xl space-y-6">
      <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ duration: 0.3, ease: easeOutQuart }}>
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2">
          <Link href={`/clusters/${clusterId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Cluster
          </Link>
        </Button>
      </motion.div>

      <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Create New Project</h1>
        <p className="text-sm text-zinc-500 mt-1">Deploy and manage workloads in this project</p>
      </motion.div>

      <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ duration: 0.4, delay: 0.12, ease: easeOutQuart }}>
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Enter the details for your new Kubernetes project</CardDescription>
          </CardHeader>
          <CardContent>
            <Form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField label="Project Name" error={form.formState.errors.name?.message} required>
                <Input {...form.register('name')} placeholder="my-project" disabled={isSubmitting} />
              </FormField>

              <FormField label="Description" error={form.formState.errors.description?.message}>
                <Input {...form.register('description')} placeholder="Optional project description" disabled={isSubmitting} />
              </FormField>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => router.push(`/clusters/${clusterId}`)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Project'}</Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
