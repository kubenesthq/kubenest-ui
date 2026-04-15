'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteWorkload } from '@/hooks/useWorkloads';
import { useToast } from '@/components/ui/use-toast';
import type { Workload } from '@/types/api';

interface Props {
  workload: Workload;
}

export function WorkloadSettingsTab({ workload }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const deleteMutation = useDeleteWorkload();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const canDelete = confirmText === workload.name && !deleteMutation.isPending;

  const handleDelete = () => {
    deleteMutation.mutate(workload.id, {
      onSuccess: () => {
        toast({ title: 'Workload deleted' });
        router.push(`/projects/${workload.project_id}`);
      },
      onError: (err: Error) =>
        toast({ title: 'Delete failed', description: err.message, variant: 'error' }),
    });
  };

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Danger zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-6 rounded-md border border-red-100 bg-red-50/50 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900">Delete workload</p>
            <p className="text-sm text-zinc-500 mt-1">
              Permanently removes <strong>{workload.name}</strong> and all Kubernetes
              resources it manages. This cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
            className="shrink-0"
          >
            Delete
          </Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {workload.name}?</DialogTitle>
            <DialogDescription>
              This will tear down the workload from the cluster and cannot be reversed.
              Type <strong>{workload.name}</strong> below to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={workload.name}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setConfirmText('');
              }}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete workload'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
