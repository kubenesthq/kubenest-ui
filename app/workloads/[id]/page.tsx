'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCw,
  Star,
  Check,
  X as XIcon,
  Pencil,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkloadStatusBadge } from '@/components/workloads/WorkloadStatusBadge';
import { DeploymentHistoryCard } from '@/components/workloads/DeploymentHistoryCard';
import { WorkloadSettingsTab } from '@/components/workloads/WorkloadSettingsTab';
import {
  useWorkload,
  useUpdateWorkload,
  useRedeployWorkload,
} from '@/hooks/useWorkloads';
import { useSSE } from '@/hooks/useSSE';
import { useCurrentOrg } from '@/hooks/useOrganization';
import { getProject } from '@/api/projects';
import { getCluster } from '@/api/clusters';
import { useToast } from '@/components/ui/use-toast';
import { WORKLOAD_LIMITS } from '@/lib/constants/workloads';

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};
const easeOutQuart = [0.25, 1, 0.5, 1] as const;

type EditField = 'image' | 'replicas' | 'port' | null;

export default function WorkloadDetailPage() {
  const params = useParams();
  const workloadId = params.id as string;
  const { toast } = useToast();

  useSSE({ resource_type: 'workload', workload_id: workloadId }, !!workloadId);

  const { data: workload, isLoading } = useWorkload(workloadId);
  const updateMutation = useUpdateWorkload(workloadId);
  const redeployMutation = useRedeployWorkload(workloadId);

  const { data: project } = useQuery({
    queryKey: ['project', workload?.project_id],
    queryFn: () => getProject(workload!.project_id),
    enabled: !!workload?.project_id,
  });
  const { data: cluster } = useQuery({
    queryKey: ['cluster', project?.cluster_id],
    queryFn: () => getCluster(project!.cluster_id),
    enabled: !!project?.cluster_id,
  });
  const { org } = useCurrentOrg();

  const [favorite, setFavorite] = useState(false);
  const [editField, setEditField] = useState<EditField>(null);
  const [draft, setDraft] = useState<string>('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!workload) {
    return (
      <div className="px-8 py-8 max-w-6xl">
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-400">
            Workload not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const startEdit = (field: Exclude<EditField, null>, current: string) => {
    setEditField(field);
    setDraft(current);
  };

  const cancelEdit = () => {
    setEditField(null);
    setDraft('');
  };

  const saveEdit = () => {
    if (!editField) return;
    const trimmed = draft.trim();
    if (editField === 'image') {
      if (!trimmed || trimmed === workload.image) return cancelEdit();
      updateMutation.mutate(
        { image: trimmed },
        {
          onSuccess: () => {
            toast({ title: 'Image updated', description: trimmed });
            cancelEdit();
          },
          onError: (err: Error) =>
            toast({ title: 'Update failed', description: err.message, variant: 'error' }),
        }
      );
      return;
    }
    const numeric = parseInt(trimmed, 10);
    if (Number.isNaN(numeric)) return cancelEdit();
    if (editField === 'replicas') {
      const clamped = Math.max(
        WORKLOAD_LIMITS.MIN_REPLICAS,
        Math.min(WORKLOAD_LIMITS.MAX_REPLICAS, numeric)
      );
      if (clamped === workload.replicas) return cancelEdit();
      updateMutation.mutate(
        { replicas: clamped },
        {
          onSuccess: () => {
            toast({ title: 'Replicas updated', description: `${clamped}` });
            cancelEdit();
          },
          onError: (err: Error) =>
            toast({ title: 'Update failed', description: err.message, variant: 'error' }),
        }
      );
      return;
    }
    if (editField === 'port') {
      if (numeric === workload.port) return cancelEdit();
      updateMutation.mutate(
        { port: numeric },
        {
          onSuccess: () => {
            toast({ title: 'Port updated', description: `${numeric}` });
            cancelEdit();
          },
          onError: (err: Error) =>
            toast({ title: 'Update failed', description: err.message, variant: 'error' }),
        }
      );
    }
  };

  const handleRedeploy = () => {
    redeployMutation.mutate(undefined, {
      onSuccess: () => toast({ title: 'Redeploy triggered' }),
      onError: (err: Error) =>
        toast({ title: 'Redeploy failed', description: err.message, variant: 'error' }),
    });
  };

  const primaryUrl = workload.url;

  return (
    <div className="px-8 py-8 max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <motion.nav
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: easeOutQuart }}
        className="flex items-center gap-1.5 text-sm text-zinc-500"
      >
        {cluster && (
          <>
            <Link href={`/clusters/${cluster.id}`} className="hover:text-zinc-900">
              {cluster.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
          </>
        )}
        {project && (
          <>
            <Link href={`/projects/${project.id}`} className="hover:text-zinc-900">
              {project.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
          </>
        )}
        <span className="text-zinc-900 font-medium">{workload.name}</span>
      </motion.nav>

      {/* Header */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
        className="space-y-3"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <button
              type="button"
              onClick={() => setFavorite((f) => !f)}
              aria-label={favorite ? 'Unfavorite' : 'Favorite'}
              className="text-zinc-300 hover:text-amber-500 transition-colors"
            >
              <Star
                className={`h-5 w-5 ${favorite ? 'fill-amber-400 text-amber-500' : ''}`}
              />
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 truncate">
              {workload.name}
            </h1>
            <WorkloadStatusBadge phase={workload.phase} />
            {primaryUrl && (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                {primaryUrl.replace(/^https?:\/\//, '')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" disabled title="Restart coming soon">
              <RotateCw className="h-3.5 w-3.5 mr-1.5" />
              Restart
            </Button>
            <Button
              size="sm"
              onClick={handleRedeploy}
              disabled={redeployMutation.isPending}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${redeployMutation.isPending ? 'animate-spin' : ''}`}
              />
              {redeployMutation.isPending ? 'Deploying...' : 'Redeploy'}
            </Button>
          </div>
        </div>

        {/* Chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {org && <Chip label="Org" value={org.name} />}
          {project && <Chip label="Project" value={project.name} />}
          {cluster && <Chip label="Cluster" value={cluster.name} />}
          {project && <Chip label="Namespace" value={project.namespace} />}
        </div>
      </motion.div>

      {/* Inline-edit strip */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
        className="flex items-stretch gap-0 rounded-lg border border-zinc-200 bg-white divide-x divide-zinc-200 overflow-hidden"
      >
        <EditCell
          label="Image"
          value={workload.image ?? '—'}
          monospace
          editing={editField === 'image'}
          draft={draft}
          onDraftChange={setDraft}
          onStart={() => startEdit('image', workload.image ?? '')}
          onSave={saveEdit}
          onCancel={cancelEdit}
          saving={updateMutation.isPending && editField === 'image'}
          disabled={!!workload.chart_config?.chart}
        />
        <EditCell
          label="Replicas"
          value={`${workload.replicas}`}
          editing={editField === 'replicas'}
          draft={draft}
          onDraftChange={setDraft}
          onStart={() => startEdit('replicas', `${workload.replicas}`)}
          onSave={saveEdit}
          onCancel={cancelEdit}
          saving={updateMutation.isPending && editField === 'replicas'}
          inputType="number"
        />
        <EditCell
          label="Port"
          value={workload.port ? `${workload.port}` : '—'}
          editing={editField === 'port'}
          draft={draft}
          onDraftChange={setDraft}
          onStart={() => startEdit('port', workload.port ? `${workload.port}` : '')}
          onSave={saveEdit}
          onCancel={cancelEdit}
          saving={updateMutation.isPending && editField === 'port'}
          inputType="number"
        />
      </motion.div>

      {/* Tabs */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.15, ease: easeOutQuart }}
      >
        <Tabs defaultValue="deployments" className="w-full">
          <TabsList className="h-10">
            <TabsTrigger value="deployments">Deployments</TabsTrigger>
            <TabsTrigger value="environment">Environment</TabsTrigger>
            <TabsTrigger value="domains">Domains</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="deployments" className="mt-4">
            <DeploymentHistoryCard workloadId={workloadId} />
          </TabsContent>

          <TabsContent value="environment" className="mt-4">
            <TabEmpty title="Environment" message="Env var management coming soon." />
          </TabsContent>

          <TabsContent value="domains" className="mt-4">
            <TabEmpty title="Domains" message="Ingress and domain management coming soon." />
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <TabEmpty title="Logs" message="Live log streaming coming soon." />
          </TabsContent>

          <TabsContent value="metrics" className="mt-4">
            <TabEmpty
              title="Metrics"
              message="Grafana panels embed when monitoring lands."
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <WorkloadSettingsTab workload={workload} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-600">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-700">{value}</span>
    </span>
  );
}

interface EditCellProps {
  label: string;
  value: string;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  monospace?: boolean;
  inputType?: 'text' | 'number';
  disabled?: boolean;
}

function EditCell({
  label,
  value,
  editing,
  draft,
  onDraftChange,
  onStart,
  onSave,
  onCancel,
  saving,
  monospace,
  inputType = 'text',
  disabled,
}: EditCellProps) {
  return (
    <div className="flex-1 min-w-0 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
        {label}
      </p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            type={inputType}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
            disabled={saving}
            className="h-7 text-sm"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={onSave}
            disabled={saving}
            aria-label="Save"
            className="h-7 w-7 shrink-0"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            aria-label="Cancel"
            className="h-7 w-7 shrink-0"
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={disabled ? undefined : onStart}
          disabled={disabled}
          className={`group flex items-center gap-2 w-full text-left ${
            disabled ? 'cursor-not-allowed opacity-70' : 'hover:text-blue-600'
          }`}
        >
          <span
            className={`truncate text-sm text-zinc-900 ${monospace ? 'font-mono' : 'font-medium'}`}
          >
            {value}
          </span>
          {!disabled && (
            <Pencil className="h-3 w-3 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </button>
      )}
    </div>
  );
}

function TabEmpty({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-zinc-200 border-dashed">
      <CardContent className="py-16 text-center">
        <p className="text-sm font-semibold text-zinc-700">{title}</p>
        <p className="text-sm text-zinc-400 mt-1">{message}</p>
      </CardContent>
    </Card>
  );
}
