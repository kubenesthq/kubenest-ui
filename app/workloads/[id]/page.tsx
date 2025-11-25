'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { Minus, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkloadStatusBadge } from '@/components/workloads/WorkloadStatusBadge';
import { PhaseIndicator } from '@/components/workloads/PhaseIndicator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWorkload, useScaleWorkload, useDeleteWorkload } from '@/hooks/useWorkloads';
import { getProject } from '@/api/projects';

export default function WorkloadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workloadId = params.id as string;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [desiredReplicas, setDesiredReplicas] = useState<number>(1);
  const [isScaling, setIsScaling] = useState(false);

  // Fetch workload data
  const { data: workloadData, isLoading: workloadLoading } = useWorkload(workloadId);
  const workload = workloadData?.data;

  // Set initial replica count when workload loads
  useState(() => {
    if (workload) {
      setDesiredReplicas(workload.replicas);
    }
  });

  // Fetch parent project data
  const { data: projectData } = useQuery({
    queryKey: ['project', workload?.project_id],
    queryFn: () => getProject(workload!.project_id),
    enabled: !!workload?.project_id,
  });
  const project = projectData?.data;

  // Scale mutation
  const scaleMutation = useScaleWorkload(workloadId);

  // Delete mutation
  const deleteMutation = useDeleteWorkload();

  const handleScale = () => {
    if (desiredReplicas === workload?.replicas) {
      return; // No change
    }

    setIsScaling(true);
    scaleMutation.mutate(desiredReplicas, {
      onSuccess: () => {
        setIsScaling(false);
      },
      onError: (error: Error) => {
        alert(`Failed to scale workload: ${error.message}`);
        setIsScaling(false);
        // Reset to current replicas
        setDesiredReplicas(workload?.replicas || 1);
      },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(workloadId, {
      onSuccess: () => {
        router.push(`/projects/${workload?.project_id}`);
      },
      onError: (error: Error) => {
        alert(`Failed to delete workload: ${error.message}`);
        setShowDeleteDialog(false);
      },
    });
  };

  const incrementReplicas = () => {
    setDesiredReplicas((prev) => Math.min(prev + 1, 100));
  };

  const decrementReplicas = () => {
    setDesiredReplicas((prev) => Math.max(prev - 1, 0));
  };

  if (workloadLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading workload...</div>
      </div>
    );
  }

  if (!workload) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Workload not found
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasReplicaChanges = desiredReplicas !== workload.replicas;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{workload.name}</h1>
            <WorkloadStatusBadge phase={workload.phase} />
          </div>
          <p className="text-muted-foreground mt-1">
            Created {format(new Date(workload.created_at), 'MMMM d, yyyy')}
          </p>
          {project && (
            <p className="text-sm text-muted-foreground">
              Project:{' '}
              <Link
                href={`/projects/${project.id}`}
                className="text-primary hover:underline"
              >
                {project.name}
              </Link>
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Workload
          </Button>
        </div>
      </div>

      {/* Phase Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <PhaseIndicator currentPhase={workload.phase} />
        </CardContent>
      </Card>

      {/* Details and Scale Controls */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workload Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Name</div>
              <div className="text-lg font-semibold">{workload.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Image</div>
              <code className="text-sm bg-muted px-2 py-1 rounded block truncate">
                {workload.image}
              </code>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Port</div>
              <div className="text-sm">{workload.port || 'Not specified'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="mt-1">
                <WorkloadStatusBadge phase={workload.phase} />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Current Replicas</div>
              <div className="text-2xl font-bold">{workload.replicas}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Created</div>
              <div className="text-sm">
                {format(new Date(workload.created_at), 'PPpp')}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
              <div className="text-sm">
                {format(new Date(workload.updated_at), 'PPpp')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scale Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-3">
                Adjust Replicas
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={decrementReplicas}
                  disabled={isScaling || desiredReplicas <= 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={desiredReplicas}
                  onChange={(e) => setDesiredReplicas(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={isScaling}
                  className="w-24 text-center text-lg font-semibold"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={incrementReplicas}
                  disabled={isScaling || desiredReplicas >= 100}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 px-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm font-medium">Current</div>
                <div className="text-2xl font-bold">{workload.replicas}</div>
              </div>
              <div className="text-2xl text-muted-foreground">→</div>
              <div>
                <div className="text-sm font-medium">Desired</div>
                <div className="text-2xl font-bold text-primary">{desiredReplicas}</div>
              </div>
            </div>

            <Button
              onClick={handleScale}
              disabled={!hasReplicaChanges || isScaling}
              className="w-full"
            >
              {isScaling ? 'Scaling...' : 'Apply Scale Changes'}
            </Button>

            {hasReplicaChanges && !isScaling && (
              <p className="text-sm text-muted-foreground text-center">
                Click to scale from {workload.replicas} to {desiredReplicas} replicas
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Events */}
      <Card>
        <CardHeader>
          <CardTitle>Status Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
              <div className="flex-1">
                <div className="font-medium">Workload created</div>
                <div className="text-muted-foreground text-xs">
                  {format(new Date(workload.created_at), 'PPpp')}
                </div>
              </div>
            </div>
            {workload.updated_at !== workload.created_at && (
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                <div className="flex-1">
                  <div className="font-medium">Workload updated</div>
                  <div className="text-muted-foreground text-xs">
                    {format(new Date(workload.updated_at), 'PPpp')}
                  </div>
                </div>
              </div>
            )}
            {workload.phase === 'Running' && (
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                <div className="flex-1">
                  <div className="font-medium">Deployment successful</div>
                  <div className="text-muted-foreground text-xs">
                    Workload is running with {workload.replicas} replica(s)
                  </div>
                </div>
              </div>
            )}
            {workload.phase === 'Failed' && (
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5"></div>
                <div className="flex-1">
                  <div className="font-medium">Deployment failed</div>
                  <div className="text-muted-foreground text-xs">
                    Check operator logs for details
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workload</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{workload.name}</strong>?
              This will remove the workload from Kubernetes and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Workload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
