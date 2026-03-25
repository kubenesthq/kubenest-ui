'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { createDemoCluster } from '@/lib/demo-store';
import { useState } from 'react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

const clusterSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(63, 'Name must be at most 63 characters')
    .regex(
      /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
      'Name must be lowercase alphanumeric with hyphens'
    ),
  description: z.string().optional(),
});

type ClusterFormData = z.infer<typeof clusterSchema>;

export default function NewClusterPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth(true);
  const [created, setCreated] = useState(false);
  const [clusterName, setClusterName] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClusterFormData>({
    resolver: zodResolver(clusterSchema),
  });

  const onSubmit = (data: ClusterFormData) => {
    const cluster = createDemoCluster({
      name: data.name,
      description: data.description,
    });
    setClusterName(data.name);
    setCreated(true);
    setTimeout(() => {
      router.push(`/clusters/${cluster.id}`);
    }, 1500);
  };

  if (!isAuthenticated) return null;

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
          <h2 className="text-2xl font-bold text-zinc-900">Cluster Registered</h2>
          <p className="text-zinc-500">
            <span className="font-mono text-zinc-700">{clusterName}</span> is connected and ready.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-2xl space-y-6">
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: easeOutQuart }}
      >
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Dashboard
          </Link>
        </Button>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Register New Cluster</h1>
        <p className="text-sm text-zinc-500 mt-1">Add a new Kubernetes cluster to Kubenest</p>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.12, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Cluster Information</CardTitle>
            <CardDescription>Provide details about your Kubernetes cluster</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Cluster Name <span className="text-destructive">*</span></Label>
                <Input id="name" placeholder="production-us-west" {...register('name')} aria-invalid={!!errors.name} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                <p className="text-xs text-muted-foreground">DNS-compliant name (lowercase, alphanumeric, hyphens only)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" placeholder="Primary production cluster in US West region" {...register('description')} />
              </div>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => router.push('/dashboard')} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Register Cluster'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
