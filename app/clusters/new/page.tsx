'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InstallCommandModal } from '@/components/clusters/InstallCommandModal';
import { useCreateCluster } from '@/hooks/useClusters';
import { useAuth } from '@/hooks/useAuth';
import type { ClusterCreateResponse } from '@/types/api';

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
  const [createdCluster, setCreatedCluster] = useState<ClusterCreateResponse | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClusterFormData>({
    resolver: zodResolver(clusterSchema),
  });

  const createClusterMutation = useCreateCluster();

  const onSubmit = async (data: ClusterFormData) => {
    try {
      const cluster = await createClusterMutation.mutateAsync(data);
      setCreatedCluster(cluster);
      setShowInstallModal(true);
    } catch (error) {
      console.error('Failed to create cluster:', error);
    }
  };

  const handleModalClose = () => {
    setShowInstallModal(false);
    if (createdCluster) {
      router.push(`/clusters/${createdCluster.id}`);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Register New Cluster</h1>
        <p className="text-muted-foreground mt-2">
          Add a new Kubernetes cluster to Kubenest
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cluster Information</CardTitle>
          <CardDescription>
            Provide details about your Kubernetes cluster
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Cluster Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="production-us-west"
                {...register('name')}
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                DNS-compliant name (lowercase, alphanumeric, hyphens only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Primary production cluster in US West region"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            {createClusterMutation.isError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">
                  Failed to create cluster:{' '}
                  {createClusterMutation.error instanceof Error
                    ? createClusterMutation.error.message
                    : 'Unknown error'}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Register Cluster'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {createdCluster && (
        <InstallCommandModal
          open={showInstallModal}
          onOpenChange={handleModalClose}
          command={createdCluster.install_command}
          clusterName={createdCluster.name}
        />
      )}
    </div>
  );
}
