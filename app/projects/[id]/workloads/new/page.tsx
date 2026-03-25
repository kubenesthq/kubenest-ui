'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, Container, GitBranch, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getProject } from '@/api/projects';
import { WORKLOAD_LIMITS } from '@/lib/constants/workloads';
import { createDemoWorkload } from '@/lib/demo-store';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

type SourceType = 'image' | 'git';

const workloadSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only'),
  // Container image fields
  image: z.string().optional(),
  imageTag: z.string().optional(),
  // Git repo fields
  gitRepo: z.string().optional(),
  gitBranch: z.string().optional(),
  dockerfilePath: z.string().optional(),
  // Common deployment settings
  replicas: z
    .number()
    .int()
    .min(WORKLOAD_LIMITS.MIN_REPLICAS)
    .max(WORKLOAD_LIMITS.MAX_REPLICAS),
  port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .optional()
    .nullable(),
  envVars: z.string().optional(),
});

type WorkloadFormData = z.infer<typeof workloadSchema>;

export default function NewWorkloadPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [sourceType, setSourceType] = useState<SourceType>('image');
  const [deployed, setDeployed] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<WorkloadFormData>({
    resolver: zodResolver(workloadSchema),
    defaultValues: {
      name: '',
      image: '',
      imageTag: 'latest',
      gitRepo: '',
      gitBranch: 'main',
      dockerfilePath: 'Dockerfile',
      replicas: 1,
      port: 80,
      envVars: '',
    },
  });

  const workloadName = watch('name');

  const onSubmit = async (data: WorkloadFormData) => {
    if (sourceType === 'image' && !data.image) {
      setError('image', { message: 'Container image is required' });
      return;
    }
    if (sourceType === 'git' && !data.gitRepo) {
      setError('gitRepo', { message: 'Git repository URL is required' });
      return;
    }

    // Parse env vars
    const envMap: Record<string, string> = {};
    if (data.envVars?.trim()) {
      data.envVars.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          envMap[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
        }
      });
    }

    const workload = createDemoWorkload({
      project_id: projectId,
      name: data.name,
      source_type: sourceType,
      image: sourceType === 'image'
        ? `${data.image}${data.imageTag ? ':' + data.imageTag : ''}`
        : undefined,
      git_repo: sourceType === 'git' ? data.gitRepo : undefined,
      git_branch: sourceType === 'git' ? (data.gitBranch || 'main') : undefined,
      dockerfile_path: sourceType === 'git' ? (data.dockerfilePath || 'Dockerfile') : undefined,
      replicas: data.replicas,
      port: data.port ?? undefined,
      env: Object.keys(envMap).length > 0 ? envMap : undefined,
    });

    setDeployed(true);
    setTimeout(() => {
      router.push(`/demo-workloads/${workload.id}`);
    }, 1500);
  };

  if (deployed) {
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
          <h2 className="text-2xl font-bold text-zinc-900">Workload Deployed</h2>
          <p className="text-zinc-500">
            <span className="font-mono text-zinc-700">{workloadName}</span> is being deployed to your cluster.
          </p>
        </motion.div>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Deploy Workload</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Deploy from a container image or a Git repository
        </p>
      </motion.div>

      {/* Source Type Selection */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
        className="grid grid-cols-2 gap-4"
      >
        <button
          type="button"
          onClick={() => setSourceType('image')}
          className={`relative p-5 rounded-lg border-2 text-left transition-all ${
            sourceType === 'image'
              ? 'border-zinc-900 bg-zinc-50'
              : 'border-zinc-200 hover:border-zinc-300 bg-white'
          }`}
        >
          <Container className={`h-6 w-6 mb-2 ${sourceType === 'image' ? 'text-zinc-900' : 'text-zinc-400'}`} />
          <p className="font-medium text-zinc-900">Container Image</p>
          <p className="text-xs text-zinc-500 mt-1">Deploy from Docker Hub, GHCR, or any registry</p>
          {sourceType === 'image' && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSourceType('git')}
          className={`relative p-5 rounded-lg border-2 text-left transition-all ${
            sourceType === 'git'
              ? 'border-zinc-900 bg-zinc-50'
              : 'border-zinc-200 hover:border-zinc-300 bg-white'
          }`}
        >
          <GitBranch className={`h-6 w-6 mb-2 ${sourceType === 'git' ? 'text-zinc-900' : 'text-zinc-400'}`} />
          <p className="font-medium text-zinc-900">Git Repository</p>
          <p className="text-xs text-zinc-500 mt-1">Build and deploy from source code</p>
          {sourceType === 'git' && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </button>
      </motion.div>

      {/* Form */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.15, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>
              {sourceType === 'image' ? 'Image Configuration' : 'Repository Configuration'}
            </CardTitle>
            <CardDescription>
              {sourceType === 'image'
                ? 'Specify the container image to deploy'
                : 'Point to your Git repository and we\'ll build it'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Workload Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="my-app"
                  {...register('name')}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Container Image Source */}
              {sourceType === 'image' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="image">
                      Image <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Input
                          id="image"
                          placeholder="nginx"
                          {...register('image')}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          id="imageTag"
                          placeholder="latest"
                          {...register('imageTag')}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    {errors.image && (
                      <p className="text-sm text-destructive">{errors.image.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      e.g. nginx, ghcr.io/org/app, or registry.example.com/image
                    </p>
                  </div>
                </>
              )}

              {/* Git Repo Source */}
              {sourceType === 'git' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="gitRepo">
                      Repository URL <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="gitRepo"
                      placeholder="https://github.com/org/repo"
                      {...register('gitRepo')}
                      disabled={isSubmitting}
                    />
                    {errors.gitRepo && (
                      <p className="text-sm text-destructive">{errors.gitRepo.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gitBranch">Branch</Label>
                      <Input
                        id="gitBranch"
                        placeholder="main"
                        {...register('gitBranch')}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dockerfilePath">Dockerfile Path</Label>
                      <Input
                        id="dockerfilePath"
                        placeholder="Dockerfile"
                        {...register('dockerfilePath')}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Divider */}
              <div className="border-t border-zinc-100" />

              {/* Deployment Settings */}
              <div>
                <p className="text-sm font-medium text-zinc-900 mb-4">Deployment Settings</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="replicas">Replicas</Label>
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="80"
                      {...register('port', {
                        setValueAs: (v) => (v === '' || v === null || v === undefined) ? undefined : Number(v)
                      })}
                      disabled={isSubmitting}
                    />
                    {errors.port && (
                      <p className="text-sm text-destructive">{errors.port.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="space-y-2">
                <Label htmlFor="envVars">
                  Environment Variables <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="envVars"
                  placeholder={"NODE_ENV=production\nDATABASE_URL=postgres://...\nAPI_KEY=sk-..."}
                  rows={4}
                  className="font-mono text-xs"
                  {...register('envVars')}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  One per line, KEY=VALUE format. Lines starting with # are ignored.
                </p>
              </div>

              {/* Error */}
              {errors.root && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-destructive">{errors.root.message}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/projects/${projectId}`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Deploying...' : 'Deploy'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
