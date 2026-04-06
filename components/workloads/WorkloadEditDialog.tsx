'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AddonExportPicker } from './AddonExportPicker';
import { useUpdateWorkload } from '@/hooks/useWorkloads';
import type { Workload, EnvVarInput, IngressConfig } from '@/types/api';

interface EditFormData {
  image?: string;
  replicas?: number;
  port?: number | null;
  ingress_enabled: boolean;
  ingress_host?: string;
  ingress_path?: string;
}

interface WorkloadEditDialogProps {
  workload: Workload;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkloadEditDialog({ workload, open, onOpenChange }: WorkloadEditDialogProps) {
  const updateMutation = useUpdateWorkload(workload.id);
  const [envVars, setEnvVars] = useState<EnvVarInput[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditFormData>();

  useEffect(() => {
    if (open && workload) {
      reset({
        image: workload.image ?? '',
        replicas: workload.replicas,
        port: workload.port,
        ingress_enabled: workload.ingress_config?.enabled ?? false,
        ingress_host: workload.ingress_config?.host ?? '',
        ingress_path: workload.ingress_config?.path ?? '/',
      });
      // Convert env_config to EnvVarInput format
      const envInputs: EnvVarInput[] = (workload.env_config ?? []).map((e) => {
        if (e.valueFrom) {
          const exportRef = (e.valueFrom as Record<string, unknown>)?.exportRef as Record<string, string> | undefined;
          return {
            name: e.name,
            export_ref: exportRef ? {
              addon_instance_id: exportRef.component ?? '',
              export_key: exportRef.key ?? '',
            } : undefined,
          };
        }
        return { name: e.name, value: e.value ?? '' };
      });
      setEnvVars(envInputs);
    }
  }, [open, workload, reset]);

  const onSubmit = (data: EditFormData) => {
    setError(null);
    const ingress: IngressConfig | undefined = data.ingress_enabled
      ? {
          enabled: true,
          host: data.ingress_host || null,
          path: data.ingress_path || '/',
          tls_secret: workload.ingress_config?.tls_secret ?? null,
          annotations: workload.ingress_config?.annotations ?? null,
        }
      : undefined;

    const envPayload = envVars.length > 0
      ? envVars.filter((e) => e.name.trim()).map((e) => {
          if (e.export_ref) {
            return { name: e.name, export_ref: e.export_ref };
          }
          return { name: e.name, value: e.value ?? '' };
        })
      : undefined;

    updateMutation.mutate(
      {
        image: data.image || undefined,
        replicas: data.replicas,
        port: data.port ?? undefined,
        ingress,
        env: envPayload,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError(err instanceof Error ? err.message : 'Update failed'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Workload</DialogTitle>
          <DialogDescription>
            Update configuration for <strong>{workload.name}</strong>. Changes trigger a redeploy.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="image">Image</Label>
            <Input
              id="image"
              placeholder="nginx:1.21"
              {...register('image')}
              className="font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="replicas">Replicas</Label>
              <Input
                id="replicas"
                type="number"
                min={0}
                max={100}
                {...register('replicas')}
              />
              {errors.replicas && (
                <p className="text-xs text-red-500 mt-1">{errors.replicas.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                {...register('port')}
              />
              {errors.port && (
                <p className="text-xs text-red-500 mt-1">{errors.port.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ingress_enabled"
                {...register('ingress_enabled')}
                className="rounded border-zinc-300"
              />
              <Label htmlFor="ingress_enabled" className="text-sm">Enable Ingress</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ingress_host">Host</Label>
                <Input
                  id="ingress_host"
                  placeholder="app.example.com"
                  {...register('ingress_host')}
                />
              </div>
              <div>
                <Label htmlFor="ingress_path">Path</Label>
                <Input
                  id="ingress_path"
                  placeholder="/"
                  {...register('ingress_path')}
                />
              </div>
            </div>
          </div>

          <AddonExportPicker
            projectId={workload.project_id}
            value={envVars}
            onChange={setEnvVars}
          />

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
