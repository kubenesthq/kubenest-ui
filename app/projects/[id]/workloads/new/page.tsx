'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  FileCode,
  Layers,
  ChevronDown,
  Globe,
  Plus,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getProject } from '@/api/projects';
import { WORKLOAD_LIMITS } from '@/lib/constants/workloads';
import { workloadsApi } from '@/lib/api/workloads';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

type SourceType = 'image' | 'git';
type BuildMethod = 'dockerfile' | 'buildpacks';

const workloadSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only'),
  image: z.string().optional(),
  imageTag: z.string().optional(),
  gitRepo: z.string().optional(),
  gitBranch: z.string().optional(),
  dockerfilePath: z.string().optional(),
  buildContext: z.string().optional(),
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
  ingressHost: z.string().optional(),
  envVars: z.string().optional(),
});

type WorkloadFormData = z.infer<typeof workloadSchema>;

/* ---------- reusable layout pieces ---------- */

function FormRow({
  label,
  description,
  required,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[240px_1fr] gap-8 items-start py-5">
      <div className="pt-2">
        <p className="text-sm font-medium text-zinc-900">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </p>
        {description && (
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SectionDivider() {
  return <div className="border-t border-zinc-100" />;
}

function OptionCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-4 rounded-lg border-2 text-left transition-all flex items-start gap-3 ${
        selected
          ? 'border-zinc-900 bg-zinc-50'
          : 'border-zinc-200 hover:border-zinc-300 bg-white'
      }`}
    >
      <div className={`mt-0.5 ${selected ? 'text-zinc-900' : 'text-zinc-400'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-zinc-900">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  );
}

/* ---------- env var row helpers ---------- */

interface EnvEntry {
  key: string;
  value: string;
}

function parseEnvString(s: string): EnvEntry[] {
  if (!s?.trim()) return [];
  return s
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const eq = line.indexOf('=');
      if (eq <= 0) return null;
      return { key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
    })
    .filter(Boolean) as EnvEntry[];
}

/* ---------- main page ---------- */

export default function NewWorkloadPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [sourceType, setSourceType] = useState<SourceType>('image');
  const [buildMethod, setBuildMethod] = useState<BuildMethod>('dockerfile');
  const [deployed, setDeployed] = useState(false);
  const [showIngress, setShowIngress] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [showBuildSettings, setShowBuildSettings] = useState(false);

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
      buildContext: './',
      replicas: 1,
      port: 80,
      ingressHost: '',
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

    const envEntries = parseEnvString(data.envVars ?? '');
    const envArray = envEntries.map(({ key, value }) => ({ name: key, value }));

    try {
      await workloadsApi.create({
        project_id: projectId,
        name: data.name,
        image:
          sourceType === 'image'
            ? `${data.image}${data.imageTag ? ':' + data.imageTag : ''}`
            : undefined,
        git_source: sourceType === 'git' ? data.gitRepo : undefined,
        build_config:
          sourceType === 'git'
            ? {
                method: buildMethod,
                dockerfile: buildMethod === 'dockerfile' ? data.dockerfilePath : undefined,
                context: data.buildContext || './',
              }
            : undefined,
        replicas: data.replicas,
        port: data.port ?? undefined,
        env: envArray.length > 0 ? envArray : undefined,
        ingress:
          showIngress && data.ingressHost
            ? {
                enabled: true,
                host: data.ingressHost,
                path: '/',
                tls_secret: null,
                annotations: null,
              }
            : undefined,
      });

      setDeployed(true);
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 1500);
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to deploy workload',
      });
    }
  };

  /* success state */
  if (deployed) {
    return (
      <div className="px-8 py-8 max-w-3xl mx-auto flex items-center justify-center min-h-[60vh]">
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
            <span className="font-mono text-zinc-700">{workloadName}</span> is being
            deployed to your cluster.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto space-y-6">
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

      {/* Header + source toggle */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Deploy from {sourceType === 'image' ? 'Container Image' : 'Git Repository'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {sourceType === 'image' ? (
            <>
              <button
                type="button"
                onClick={() => setSourceType('git')}
                className="text-zinc-900 underline underline-offset-2 hover:text-zinc-600 transition-colors"
              >
                Deploy from Git repository instead →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSourceType('image')}
                className="text-zinc-900 underline underline-offset-2 hover:text-zinc-600 transition-colors"
              >
                Deploy from Container Registry instead →
              </button>
            </>
          )}
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-lg border border-zinc-200 bg-white">
            {/* ---- Name ---- */}
            <div className="px-6">
              <FormRow
                label="Name"
                description="A unique name for your workload. Only lowercase letters, numbers, and hyphens."
                required
              >
                <Input
                  placeholder="my-app"
                  {...register('name')}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </FormRow>
            </div>

            <SectionDivider />

            {/* ---- Source-specific fields ---- */}
            <div className="px-6">
              <AnimatePresence mode="wait">
                {sourceType === 'image' ? (
                  <motion.div
                    key="image-fields"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <FormRow
                      label="Container Image"
                      description="The image to deploy. Supports Docker Hub, GHCR, or any registry."
                      required
                    >
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Input
                            placeholder="nginx"
                            {...register('image')}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="w-28">
                          <Input
                            placeholder="latest"
                            {...register('imageTag')}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                      {errors.image && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.image.message}
                        </p>
                      )}
                      <p className="text-xs text-zinc-400 mt-1.5">
                        e.g. nginx, ghcr.io/org/app, registry.example.com/image
                      </p>
                    </FormRow>
                  </motion.div>
                ) : (
                  <motion.div
                    key="git-fields"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <FormRow
                      label="Repository URL"
                      description="HTTPS URL of your Git repository."
                      required
                    >
                      <Input
                        placeholder="https://github.com/org/repo"
                        {...register('gitRepo')}
                        disabled={isSubmitting}
                      />
                      {errors.gitRepo && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.gitRepo.message}
                        </p>
                      )}
                    </FormRow>

                    <SectionDivider />

                    <FormRow label="Branch" description="The branch to build and deploy from.">
                      <Input
                        placeholder="main"
                        {...register('gitBranch')}
                        disabled={isSubmitting}
                      />
                    </FormRow>

                    <SectionDivider />

                    <FormRow
                      label="Build Method"
                      description="How to build your application into a container image."
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <OptionCard
                          selected={buildMethod === 'dockerfile'}
                          onClick={() => setBuildMethod('dockerfile')}
                          icon={<FileCode className="h-5 w-5" />}
                          title="Dockerfile"
                          description="Build using a Dockerfile. Full control over the build process."
                        />
                        <OptionCard
                          selected={buildMethod === 'buildpacks'}
                          onClick={() => setBuildMethod('buildpacks')}
                          icon={<Layers className="h-5 w-5" />}
                          title="Buildpacks"
                          description="Auto-detect and build. No Dockerfile needed."
                        />
                      </div>
                    </FormRow>

                    {/* Conditional: Dockerfile path */}
                    <AnimatePresence>
                      {buildMethod === 'dockerfile' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <SectionDivider />
                          <FormRow
                            label="Dockerfile Path"
                            description="Path to the Dockerfile relative to the build context."
                          >
                            <Input
                              placeholder="Dockerfile"
                              {...register('dockerfilePath')}
                              disabled={isSubmitting}
                            />
                          </FormRow>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Build settings expander */}
                    <div className="py-3">
                      <button
                        type="button"
                        onClick={() => setShowBuildSettings(!showBuildSettings)}
                        className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            showBuildSettings ? 'rotate-180' : ''
                          }`}
                        />
                        Build settings
                      </button>
                    </div>
                    <AnimatePresence>
                      {showBuildSettings && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <FormRow
                            label="Build Context"
                            description="The directory to run the build in. Defaults to the repository root."
                          >
                            <Input
                              placeholder="./"
                              {...register('buildContext')}
                              disabled={isSubmitting}
                            />
                          </FormRow>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <SectionDivider />

            {/* ---- Deployment Settings ---- */}
            <div className="px-6">
              <FormRow label="Replicas" description="Number of instances to run.">
                <Input
                  type="number"
                  min={WORKLOAD_LIMITS.MIN_REPLICAS}
                  max={WORKLOAD_LIMITS.MAX_REPLICAS}
                  className="w-24"
                  {...register('replicas', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
                {errors.replicas && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.replicas.message}
                  </p>
                )}
              </FormRow>

              <SectionDivider />

              <FormRow
                label="Port"
                description="The port your application listens on. Leave empty if not applicable."
              >
                <Input
                  type="number"
                  placeholder="80"
                  className="w-24"
                  {...register('port', {
                    setValueAs: (v) =>
                      v === '' || v === null || v === undefined ? undefined : Number(v),
                  })}
                  disabled={isSubmitting}
                />
                {errors.port && (
                  <p className="text-sm text-destructive mt-1">{errors.port.message}</p>
                )}
              </FormRow>
            </div>

            <SectionDivider />

            {/* ---- Ingress (progressive disclosure) ---- */}
            <div className="px-6">
              {!showIngress ? (
                <div className="py-4">
                  <button
                    type="button"
                    onClick={() => setShowIngress(true)}
                    className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add custom domain
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowIngress(false)}
                    className="absolute top-5 right-0 text-zinc-400 hover:text-zinc-600 transition-colors"
                    title="Remove domain"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <FormRow
                    label="Domain"
                    description="Route traffic to this workload via a custom hostname. TLS is managed automatically by cert-manager."
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-zinc-400 shrink-0" />
                      <Input
                        placeholder="app.example.com"
                        {...register('ingressHost')}
                        disabled={isSubmitting}
                      />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1">
                      <Check className="h-3 w-3 text-emerald-500" />
                      TLS auto-managed by cert-manager
                    </p>
                  </FormRow>
                </div>
              )}
            </div>

            <SectionDivider />

            {/* ---- Environment Variables (progressive disclosure) ---- */}
            <div className="px-6">
              {!showEnvVars ? (
                <div className="py-4">
                  <button
                    type="button"
                    onClick={() => setShowEnvVars(true)}
                    className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add environment variables
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEnvVars(false)}
                    className="absolute top-5 right-0 text-zinc-400 hover:text-zinc-600 transition-colors"
                    title="Remove environment variables"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <FormRow
                    label="Environment Variables"
                    description="One per line, KEY=VALUE format. Lines starting with # are ignored."
                  >
                    <textarea
                      placeholder={"NODE_ENV=production\nDATABASE_URL=postgres://...\nAPI_KEY=sk-..."}
                      rows={5}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs leading-relaxed"
                      {...register('envVars')}
                      disabled={isSubmitting}
                    />
                  </FormRow>
                </div>
              )}
            </div>

            {/* ---- Error ---- */}
            {errors.root && (
              <>
                <SectionDivider />
                <div className="px-6 py-4">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                    <p className="text-sm text-destructive">{errors.root.message}</p>
                  </div>
                </div>
              </>
            )}

            {/* ---- Actions ---- */}
            <SectionDivider />
            <div className="px-6 py-4 flex gap-3 justify-end">
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
          </div>
        </form>
      </motion.div>
    </div>
  );
}
