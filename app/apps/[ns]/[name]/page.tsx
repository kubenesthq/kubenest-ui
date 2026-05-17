'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Container,
  Database,
  Download,
  History,
  Layers,
  Link2,
  Loader2,
  Pause,
  PauseCircle,
  Play,
  PlayCircle,
  Plus,
  Sliders,
  RefreshCw,
  RotateCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getProject } from '@/api/projects';
import { getCluster } from '@/api/clusters';
import { useToast } from '@/components/ui/use-toast';
import { useSSE } from '@/hooks/useSSE';
import {
  useAddAppComponent,
  useApp,
  useAppDeployments,
  useAttachAddon,
  useDeleteApp,
  useDetachAddon,
  usePatchApp,
  usePauseApp,
  useRedeployApp,
  useRemoveAppComponent,
  useResumeApp,
  useRollbackApp,
  useScaleApp,
  useSyncAppStatus,
} from '@/hooks/useApps';
import { useCreateStackTemplateFromApp } from '@/hooks/useStackTemplates';
import { addonInstancesApi } from '@/lib/api/addons';
import { AddComponentDrawer } from '@/components/apps/AddComponentDrawer';
import {
  AttachAddonDrawer,
  linkedAddonGroupsFor,
  type LinkedAddonGroup,
} from '@/components/apps/AttachAddonDrawer';
import { RemoveComponentDialog } from '@/components/apps/RemoveComponentDialog';
import { SaveAsTemplateDialog } from '@/components/apps/SaveAsTemplateDialog';
import { ScaleComponentDialog } from '@/components/apps/ScaleComponentDialog';
import { appLogsStreamUrl } from '@/lib/api/apps';
import { ApiClientError } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { Btn, Card, Pill, SectionLabel, type PillTone } from '@/components/shell/primitives';
import { AppMonitoring } from '@/components/metrics/Metrics';
import type {
  AddonInstance,
  AppComponent,
  DriftDetail,
  AppPhase,
  AppRead,
  AppReadComponent,
  AppStatusResponse,
  DeploymentRecord,
  SyncDriftStatus,
} from '@/types/api';

const PHASE_TONE: Record<string, PillTone> = {
  Running: 'ok',
  Deploying: 'info',
  Pending: 'default',
  Degraded: 'warn',
  Failed: 'err',
  Stale: 'default',
};
const PHASE_DOT: Record<string, string> = {
  Running: 'var(--ok)',
  Deploying: 'var(--info)',
  Pending: 'var(--text-3)',
  Degraded: 'var(--warn)',
  Failed: 'var(--err)',
  Stale: 'var(--text-3)',
};
const phasePriority: Record<string, number> = {
  Failed: 4,
  Degraded: 3,
  Deploying: 2,
  Pending: 1,
  Running: 0,
};

interface LiveComponentStatus {
  phase: string;
  health?: string | null;
  sync?: string | null;
  updatedAt: number;
}

interface EnvRow {
  name: string;
  value: string;
  /** kn-a8t: when true, the value lands in a k8s Secret rather than inline helm values. */
  secret?: boolean;
  /**
   * kn-a8t: when set, this row was synthesised from a CR `valueFrom.exportRef`
   * — addon-attached env vars are read-only here and surface only so they
   * survive a round-trip through the PATCH. Edit them via Attach/Detach addon.
   */
  exportRef?: { component: string; exportKey: string };
}

interface EnvDraft {
  image: string;
  replicas: number;
  port: string;
  ingressEnabled: boolean;
  ingressHost: string;
  ingressPath: string;
  resourcesJson: string;
  paramsJson: string;
  env: EnvRow[];
  dependsOn: string[];
}

interface PatchConflictState {
  message: string;
  sync: SyncDriftStatus | null;
}

function isWorkloadType(type: unknown): boolean {
  return typeof type === 'string' && type.toLowerCase() === 'workload';
}

/**
 * Pull the live replica count off a read-side component. The GET /apps
 * response delivers workload_spec as a raw CR dict with a numeric
 * `replicas`. Returns null if the field is absent so callers can
 * distinguish "unset" from "explicitly 0".
 */
function readReplicaCount(component: AppReadComponent): number | null {
  const spec = component.workload_spec;
  if (!spec || typeof spec !== 'object') return null;
  const replicas = (spec as Record<string, unknown>).replicas;
  return typeof replicas === 'number' ? replicas : null;
}

// kn-fd5 / kn-kci: ArgoCD-internal drift rows. The operator wraps every
// kubenest app in an ArgoCD Application object; that Application's own
// `status.sync` / `status.health` flip OutOfSync the instant the app is
// created and stay there until ArgoCD finishes its first reconcile (~30-60s).
// That signal isn't drift the user cares about — it's the controller's
// internal reconcile state. We use this predicate twice:
//   - kn-fd5: if every drift detail is internal AND the app is in the
//     first 2-minute creation window, suppress the whole drift banner +
//     pill and show a neutral 'Syncing…' indicator instead.
//   - kn-kci: in DriftSurfaceCard, filter these rows out of WHAT DIFFERS
//     so users only see user-meaningful resources (Deployments etc.).
function isArgoCdInternalDriftDetail(detail: DriftDetail): boolean {
  const resource = typeof detail.resource === 'string' ? detail.resource : '';
  const field = typeof detail.field === 'string' ? detail.field : '';
  // `Application/<name>` (case insensitive) — emitted by the operator when
  // it surfaces an ArgoCD Application object's status. Backend may also
  // emit the kind+group form `argoproj.io/Application` or include the group
  // in a separate detail field — match both shapes leniently.
  const isApplicationKind =
    /^application\//i.test(resource)
    || /\bargoproj\.io\b/i.test(resource)
    || /(^|[/])argoproj\.io[/.]application/i.test(resource);
  if (isApplicationKind) return true;
  // Field path under `status.sync` / `status.health` is always ArgoCD's
  // own reconcile state.
  return /^status\.(sync|health)\b/i.test(field);
}

const INITIAL_SYNC_WINDOW_MS = 120_000;

/**
 * kn-fd5: suppress the drift banner during the initial ArgoCD reconcile
 * window after app creation. Returns true ONLY when every condition holds:
 *   - app.created_at is within the last 120 s,
 *   - every drift detail is ArgoCD-internal (Application/status.sync/health),
 *   - at least one component reports Running or Pending phase (i.e. nothing
 *     has actively failed — Failed/Degraded means the drift is real).
 */
function isInitialSyncWindow(
  app: AppRead | undefined,
  sync: SyncDriftStatus | null,
  statuses: Record<string, LiveComponentStatus>,
  now: number,
): boolean {
  if (!app || !sync || !sync.driftDetected) return false;
  if (sync.driftClass === 'blocked_sync') return false; // blocked drift is never just initial-sync noise
  if (!app.created_at) return false;
  const ageMs = now - new Date(app.created_at).getTime();
  if (!(ageMs >= 0 && ageMs <= INITIAL_SYNC_WINDOW_MS)) return false;
  const details = Array.isArray(sync.driftDetails) ? sync.driftDetails : [];
  if (details.length === 0) return false;
  if (!details.every(isArgoCdInternalDriftDetail)) return false;
  const hasUsableComponent = app.components.some((component) => {
    const phase = statuses[component.name]?.phase ?? app.phase;
    return phase === 'Running' || phase === 'Pending' || phase === 'Deploying';
  });
  return hasUsableComponent;
}

function PhaseBadge({ phase, pulsing = false }: { phase: string; pulsing?: boolean }) {
  return (
    <Pill tone={PHASE_TONE[phase] ?? 'default'} size="sm" className={pulsing ? 'breathe' : undefined}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: PHASE_DOT[phase] ?? 'var(--text-3)' }} />
      {phase}
    </Pill>
  );
}

function computeAggregatePhase(
  components: AppReadComponent[],
  statusByName: Record<string, LiveComponentStatus>,
  fallback: AppPhase,
): AppPhase {
  const workloadPhases = components
    .filter((c) => isWorkloadType(c.type))
    .map((c) => statusByName[c.name]?.phase ?? fallback);

  if (workloadPhases.length === 0) return fallback;

  const winner = workloadPhases.reduce((acc, cur) => {
    const score = phasePriority[cur] ?? 0;
    const best = phasePriority[acc] ?? 0;
    return score > best ? cur : acc;
  }, workloadPhases[0]);

  return (winner as AppPhase) ?? fallback;
}

function defaultEnvDraft(): EnvDraft {
  return {
    image: '',
    replicas: 1,
    port: '',
    ingressEnabled: false,
    ingressHost: '',
    ingressPath: '/',
    resourcesJson: '{}',
    paramsJson: '{}',
    env: [{ name: '', value: '' }],
    dependsOn: [],
  };
}

/**
 * kn-a8t: seed an editor draft from the LIVE component's workload_spec on
 * the read-side `AppRead.components[]` rather than from a deployment-history
 * snapshot. The CR shape uses camelCase (workloadSpec.image / port / env)
 * with kubernetes-flavoured env entries (`{name, value}` or
 * `{name, valueFrom: {secretKeyRef|exportRef}}`); we normalize that into
 * the editor's EnvRow shape so previously-PATCHed env vars are visible.
 */
function seedDraftFromComponent(component: AppReadComponent): EnvDraft | null {
  const workloadSpec = component.workload_spec;
  if (!workloadSpec || typeof workloadSpec !== 'object') return null;
  const spec = workloadSpec as Record<string, unknown>;
  const seeded = defaultEnvDraft();

  if (typeof spec.image === 'string') seeded.image = spec.image;
  if (typeof spec.replicas === 'number') seeded.replicas = spec.replicas;
  if (typeof spec.port === 'number') seeded.port = String(spec.port);

  const ingress = spec.ingress as Record<string, unknown> | undefined;
  if (ingress && typeof ingress === 'object') {
    seeded.ingressEnabled = Boolean(ingress.enabled);
    if (typeof ingress.host === 'string') seeded.ingressHost = ingress.host;
    if (typeof ingress.path === 'string') seeded.ingressPath = ingress.path;
  }

  const env = spec.env;
  if (Array.isArray(env)) {
    const parsed: EnvRow[] = [];
    for (const entry of env) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const name = typeof e.name === 'string' ? e.name : null;
      if (!name) continue;
      // valueFrom.exportRef (addon-injected) — surface as a locked row.
      const valueFrom = e.valueFrom as Record<string, unknown> | undefined;
      const exportRef = valueFrom?.exportRef as Record<string, unknown> | undefined;
      if (exportRef && typeof exportRef.component === 'string') {
        const exportKey = typeof exportRef.key === 'string'
          ? exportRef.key
          : typeof exportRef.export_key === 'string' ? exportRef.export_key : null;
        if (exportKey) {
          parsed.push({ name, value: '', exportRef: { component: exportRef.component, exportKey } });
          continue;
        }
      }
      // valueFrom.secretKeyRef — surface as an empty editable row tagged secret.
      const secretKeyRef = valueFrom?.secretKeyRef as Record<string, unknown> | undefined;
      if (secretKeyRef && typeof secretKeyRef.name === 'string') {
        parsed.push({ name, value: '', secret: true });
        continue;
      }
      // Plain inline value (or `secret: true` from a prior PATCH).
      parsed.push({
        name,
        value: typeof e.value === 'string' ? e.value : '',
        secret: e.secret === true ? true : undefined,
      });
    }
    if (parsed.length > 0) seeded.env = parsed;
  }

  const dependsOn = (component.workload_spec as Record<string, unknown>).dependsOn ?? (component.workload_spec as Record<string, unknown>).depends_on;
  if (Array.isArray(dependsOn)) {
    seeded.dependsOn = dependsOn.filter((d): d is string => typeof d === 'string');
  }
  if (spec.resources && typeof spec.resources === 'object') {
    seeded.resourcesJson = JSON.stringify(spec.resources, null, 2);
  }
  if (spec.values && typeof spec.values === 'object') {
    seeded.paramsJson = JSON.stringify(spec.values, null, 2);
  }

  return seeded;
}

function seedDraftFromHistory(componentName: string, rows: DeploymentRecord[]): EnvDraft {
  const fallback = defaultEnvDraft();
  for (const row of rows) {
    const priorState = row.prior_state as Record<string, unknown> | null;
    const spec = (priorState?.spec ?? null) as Record<string, unknown> | null;
    const components = (spec?.components ?? null) as Array<Record<string, unknown>> | null;
    if (!Array.isArray(components)) continue;

    const comp = components.find((c) => c?.name === componentName && isWorkloadType(c?.type));
    if (!comp) continue;

    const workloadSpec = (comp.workloadSpec ?? comp.workload_spec ?? null) as Record<string, unknown> | null;
    if (!workloadSpec) continue;

    const seeded = defaultEnvDraft();

    if (typeof workloadSpec.image === 'string') seeded.image = workloadSpec.image;
    if (typeof workloadSpec.replicas === 'number') seeded.replicas = workloadSpec.replicas;
    if (typeof workloadSpec.port === 'number') seeded.port = String(workloadSpec.port);

    const ingress = workloadSpec.ingress as Record<string, unknown> | undefined;
    if (ingress && typeof ingress === 'object') {
      seeded.ingressEnabled = Boolean(ingress.enabled);
      if (typeof ingress.host === 'string') seeded.ingressHost = ingress.host;
      if (typeof ingress.path === 'string') seeded.ingressPath = ingress.path;
    }

    const env = workloadSpec.env;
    if (Array.isArray(env)) {
      const parsed = env
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const name = (entry as Record<string, unknown>).name;
          const value = (entry as Record<string, unknown>).value;
          if (typeof name !== 'string') return null;
          return { name, value: typeof value === 'string' ? value : '' };
        })
        .filter((entry): entry is EnvRow => Boolean(entry));
      if (parsed.length > 0) seeded.env = parsed;
    }

    const dependsOn = comp.dependsOn ?? comp.depends_on;
    if (Array.isArray(dependsOn)) {
      seeded.dependsOn = dependsOn.filter((d): d is string => typeof d === 'string');
    }

    seeded.resourcesJson = JSON.stringify(workloadSpec.resources ?? {}, null, 2);
    seeded.paramsJson = JSON.stringify(workloadSpec.values ?? {}, null, 2);

    return seeded;
  }

  return fallback;
}

function parseObjectJson(raw: string, field: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(trimmed);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${field} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function normalizeSyncStatus(rawSync: unknown): SyncDriftStatus | null {
  if (!rawSync || typeof rawSync !== 'object') return null;
  const raw = rawSync as Record<string, unknown>;
  const detailsRaw = raw.driftDetails ?? raw.drift_details;
  const details = Array.isArray(detailsRaw)
    ? detailsRaw.filter((item) => item && typeof item === 'object') as DriftDetail[]
    : [];

  return {
    ...raw,
    desired: typeof raw.desired === 'string' ? raw.desired : null,
    observed: typeof raw.observed === 'string' ? raw.observed : null,
    driftDetected: Boolean(raw.driftDetected ?? raw.drift_detected),
    driftDetails: details,
    lastSyncRevision:
      typeof raw.lastSyncRevision === 'string'
        ? raw.lastSyncRevision
        : typeof raw.last_sync_revision === 'string'
          ? raw.last_sync_revision
          : null,
    lastSyncTime:
      typeof raw.lastSyncTime === 'string'
        ? raw.lastSyncTime
        : typeof raw.last_sync_time === 'string'
          ? raw.last_sync_time
          : null,
    syncSource:
      typeof raw.syncSource === 'string'
        ? raw.syncSource
        : typeof raw.sync_source === 'string'
          ? raw.sync_source
          : null,
    driftClass:
      typeof raw.driftClass === 'string'
        ? raw.driftClass
        : typeof raw.drift_class === 'string'
          ? raw.drift_class
          : null,
  };
}

function formatDriftValue(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

function parseGitOpsConflict(error: unknown): PatchConflictState | null {
  if (error instanceof ApiClientError) {
    const detailObject =
      error.detail && typeof error.detail === 'object'
        ? (error.detail as Record<string, unknown>)
        : null;
    const detailCode = detailObject && typeof detailObject.code === 'string' ? detailObject.code : undefined;
    const detailMessage =
      detailObject && typeof detailObject.message === 'string' ? detailObject.message : undefined;
    const sync = normalizeSyncStatus(detailObject?.sync);
    const message = detailMessage ?? error.message;
    if (
      error.status === 409
      && (error.code === 'gitops_conflict' || detailCode === 'gitops_conflict' || /drift|gitops|conflict/i.test(message))
    ) {
      return { message, sync };
    }
  }

  if (error instanceof Error && /drift|gitops|conflict/i.test(error.message)) {
    return { message: error.message, sync: null };
  }

  return null;
}

function ComponentIcon({ type }: { type: string }) {
  return isWorkloadType(type) ? (
    <Container size={15} style={{ color: 'var(--accent)' }} />
  ) : (
    <Database size={15} style={{ color: '#8b5cf6' }} />
  );
}

// Token-styled form controls — keep the page coherent across all three themes.
function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`h-8 w-full rounded-md border px-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] ${className}`}
    />
  );
}
function TTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', style, ...rest } = props;
  return (
    <textarea
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`w-full rounded-md border px-2.5 py-1.5 text-[11.5px] font-mono focus:outline-none focus:border-[var(--accent)] ${className}`}
    />
  );
}

type TabId = 'overview' | 'deploys' | 'env' | 'logs' | 'settings' | 'monitoring';
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'deploys', label: 'Deploys' },
  { id: 'env', label: 'Env' },
  { id: 'logs', label: 'Logs' },
  { id: 'settings', label: 'Settings' },
  { id: 'monitoring', label: 'Monitoring' },
];

function TabBar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) {
  return (
    <div role="tablist" style={{ borderBottom: '1px solid var(--border)' }} className="flex items-center gap-1 mb-4">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => setTab(t.id)}
            style={{ color: active ? 'var(--text)' : 'var(--text-3)', borderBottomColor: active ? 'var(--accent)' : 'transparent' }}
            className="relative h-9 px-3 text-[13px] font-medium border-b-2 -mb-px hover:text-[var(--text)] transition-colors"
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ComponentPicker({
  components,
  active,
  setActive,
  testIdPrefix,
}: {
  components: AppReadComponent[];
  active: string;
  setActive: (n: string) => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {components.map((c) => {
        const on = c.name === active;
        return (
          <button
            key={c.name}
            type="button"
            onClick={() => setActive(c.name)}
            data-testid={testIdPrefix ? `${testIdPrefix}-${c.name}` : undefined}
            style={{
              background: on ? 'var(--accent)' : 'var(--surface-2)',
              color: on ? 'var(--on-accent)' : 'var(--text-2)',
              borderColor: 'var(--border)',
            }}
            className="px-2.5 h-7 rounded-md border text-[12px] font-medium transition-colors hover:opacity-90"
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export default function AppDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-3)' }} />
        </div>
      }
    >
      <AppDetailPageInner />
    </Suspense>
  );
}

function AppDetailPageInner() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const namespace = params.ns as string;
  const name = params.name as string;
  const projectId = search.get('project_id') ?? '';

  const appQuery = useApp(namespace, name, projectId);
  const deploymentsPreview = useAppDeployments(namespace, name, projectId, 1, 20);
  const syncMutation = useSyncAppStatus(namespace, name, projectId);
  const patchMutation = usePatchApp(namespace, name, projectId);
  const redeploy = useRedeployApp(namespace, name, projectId);
  const deleteApp = useDeleteApp();
  const addComponent = useAddAppComponent(namespace, name, projectId);
  const removeComponent = useRemoveAppComponent(namespace, name, projectId);
  const attachAddon = useAttachAddon(namespace, name, projectId);
  const detachAddon = useDetachAddon(namespace, name, projectId);
  const saveAsTemplate = useCreateStackTemplateFromApp();
  const scaleApp = useScaleApp(namespace, name, projectId);
  const pauseApp = usePauseApp(namespace, name, projectId);
  const resumeApp = useResumeApp(namespace, name, projectId);

  // Project-scoped addon instances — needed to resolve `export_ref.component`
  // back to an instance id so the detach button knows which DELETE to fire.
  const addonInstancesQuery = useQuery({
    queryKey: ['addon-instances', projectId],
    queryFn: () => addonInstancesApi.list(projectId),
    enabled: Boolean(projectId),
  });
  const addonInstances = useMemo(
    () => addonInstancesQuery.data?.data ?? [],
    [addonInstancesQuery.data],
  );

  const [tab, setTab] = useState<TabId>('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addComponentOpen, setAddComponentOpen] = useState(false);
  // Which component is the remove-confirm dialog asking about (null = closed).
  const [removeTarget, setRemoveTarget] = useState<AppReadComponent | null>(null);
  const [attachAddonOpen, setAttachAddonOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  // {name, currentReplicas} of the workload component the scale dialog is
  // asking about (null = closed). Keyed by name; replicas are read from the
  // live component spec when the user clicks the scale button.
  const [scaleTarget, setScaleTarget] = useState<
    | { name: string; currentReplicas: number | null }
    | null
  >(null);
  // {addonInstanceId, displayName, envVarCount, workloadComponentName} the
  // detach-confirm dialog is asking about (null = closed). Keyed by instance
  // id rather than name so we know which DELETE to fire.
  const [detachTarget, setDetachTarget] = useState<
    | {
        addonInstanceId: string;
        addonComponentName: string;
        workloadName: string;
        envVarCount: number;
      }
    | null
  >(null);
  const [statusByName, setStatusByName] = useState<Record<string, LiveComponentStatus>>({});
  const [lastStatusRefreshAt, setLastStatusRefreshAt] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [appSync, setAppSync] = useState<SyncDriftStatus | null>(null);
  const [envDrafts, setEnvDrafts] = useState<Record<string, EnvDraft>>({});
  const [savingComponent, setSavingComponent] = useState<string | null>(null);
  const [patchConflict, setPatchConflict] = useState<PatchConflictState | null>(null);

  const sse = useSSE(
    projectId ? { project_id: projectId, resource_type: 'all' } : undefined,
    Boolean(projectId),
  );

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });

  const { data: cluster } = useQuery({
    queryKey: ['cluster', project?.cluster_id],
    queryFn: () => getCluster(project!.cluster_id),
    enabled: !!project?.cluster_id,
  });

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const applySyncStatus = useCallback((data: AppStatusResponse) => {
    const now = Date.now();
    const updates: Record<string, LiveComponentStatus> = {};
    for (const component of data.components) {
      updates[component.name] = {
        phase: component.phase,
        health: component.health ?? null,
        sync: component.sync ?? null,
        updatedAt: now,
      };
    }
    setAppSync(normalizeSyncStatus(data.sync));
    setStatusByName((prev) => ({ ...prev, ...updates }));
    setLastStatusRefreshAt(now);
    setStatusError(null);
  }, []);

  // kn-cen: stabilise refreshViaPoll by pulling `mutateAsync` out of the
  // useMutation result (the function reference itself IS stable per render in
  // TanStack Query v5; the surrounding object reference is not). Without
  // this, refreshViaPoll changed every render → the kick-off useEffect below
  // re-fired every render → infinite /sync-status storm that exhausted
  // Chrome's per-host socket pool and starved foreground PATCHes.
  const syncMutateAsync = syncMutation.mutateAsync;
  // Stop firing /sync-status once we know the app doesn't exist (newly
  // deleted, wrong cluster, race during DELETE). Without this guard, a
  // transient 404 fed the same render-loop noise and never converged.
  const [syncDisabled, setSyncDisabled] = useState(false);
  const refreshViaPoll = useCallback(async () => {
    if (syncDisabled) return;
    try {
      const data = await syncMutateAsync();
      applySyncStatus(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Status refresh failed';
      setStatusError(message);
      // One-shot disable on a permanent miss; the polling effect tears
      // down on the next render once fallbackPollingActive flips false.
      if (error instanceof ApiClientError && error.status === 404) {
        setSyncDisabled(true);
      }
    }
  }, [applySyncStatus, syncMutateAsync, syncDisabled]);

  // Kick off the initial status poll when the app identity is known.
  // refreshViaPoll is intentionally excluded from the deps — it depends on
  // syncDisabled and would cause the effect to re-fire each time the flag
  // flips, which is the same dependency-driven storm kn-cen is fixing. The
  // initial poll only needs to run when the app identity changes.
  useEffect(() => {
    if (!projectId || !namespace || !name) return;
    setSyncDisabled(false); // re-enable when the user navigates to a different app
    void refreshViaPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, namespace, projectId]);

  const fallbackPollingActive =
    !syncDisabled && (!sse.connected || sse.reconnecting || Boolean(sse.error));

  useEffect(() => {
    if (!projectId || !namespace || !name) return;
    if (!fallbackPollingActive) return;
    const id = setInterval(() => {
      void refreshViaPoll();
    }, 15000);
    return () => clearInterval(id);
  }, [fallbackPollingActive, name, namespace, projectId, refreshViaPoll]);

  // Seed the local status cache from the freshly loaded app document.
  useEffect(() => {
    const app = appQuery.data;
    if (!app) return;
    setAppSync(normalizeSyncStatus(app.sync));
    setStatusByName((prev) => {
      const next = { ...prev };
      let changed = false;
      const now = Date.now();
      for (const component of app.components) {
        if (!next[component.name]) {
          next[component.name] = { phase: app.phase, health: null, sync: null, updatedAt: now };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [appQuery.data]);

  useEffect(() => {
    const app = appQuery.data;
    const event = sse.lastEvent as Record<string, unknown> | null;
    if (!app || !event) return;

    const eventType = typeof event.event_type === 'string' ? event.event_type : '';
    if (
      eventType !== 'application_status_changed'
      && eventType !== 'workload_status_update'
      && eventType !== 'app_status_update'
    ) return;

    const payload =
      event.payload && typeof event.payload === 'object' ? (event.payload as Record<string, unknown>) : event;

    const nextSync = normalizeSyncStatus(payload.sync ?? event.sync);
    if (nextSync) {
      setAppSync(nextSync);
      setLastStatusRefreshAt(Date.now());
    }

    if (eventType === 'application_status_changed' || eventType === 'app_status_update') {
      return;
    }

    const workloadName =
      (payload.workload_name as string | undefined) ??
      (event.workload_name as string | undefined) ??
      (payload.workload_id as string | undefined) ??
      (event.workload_id as string | undefined) ??
      (event.resource_id as string | undefined);

    if (!workloadName) return;
    if (!app.components.some((component) => component.name === workloadName)) return;

    const workloadNamespace =
      (payload.workload_namespace as string | undefined) ?? (event.workload_namespace as string | undefined);
    if (workloadNamespace && workloadNamespace !== namespace) return;

    const phase =
      (payload.phase as string | undefined) ??
      (payload.status as string | undefined) ??
      (event.phase as string | undefined) ??
      'Pending';
    const health = (payload.health as string | undefined) ?? (event.health as string | undefined) ?? null;
    const sync = (payload.sync as string | undefined) ?? (event.sync as string | undefined) ?? null;

    const now = Date.now();
    setStatusByName((prev) => ({ ...prev, [workloadName]: { phase, health, sync, updatedAt: now } }));
    setLastStatusRefreshAt(now);
  }, [appQuery.data, namespace, sse.lastEvent]);

  // Clear a stale patch-conflict banner once the drift that caused it clears.
  useEffect(() => {
    if (!patchConflict) return;
    if (appSync?.driftClass !== 'blocked_sync') {
      setPatchConflict(null);
    }
  }, [appSync, patchConflict]);

  // kn-a8t: seed each workload's editing draft preferentially from the LIVE
  // component spec on the AppRead response — so env vars added via a prior
  // PATCH or via Attach addon show up. Fall back to deployment history only
  // when the live spec is empty (older create flows didn't always populate
  // workload_spec on the read side).
  useEffect(() => {
    const app = appQuery.data;
    if (!app) return;
    const rows = deploymentsPreview.data?.data ?? [];
    setEnvDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const component of app.components) {
        if (!isWorkloadType(component.type)) continue;
        if (next[component.name]) continue;
        const fromLive = seedDraftFromComponent(component);
        next[component.name] = fromLive ?? seedDraftFromHistory(component.name, rows);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [appQuery.data, deploymentsPreview.data]);

  const staleStatuses =
    !lastStatusRefreshAt ||
    clock - lastStatusRefreshAt > 45000 ||
    (fallbackPollingActive && statusError !== null);

  const app = appQuery.data;

  const aggregatePhase: AppPhase = useMemo(() => {
    if (!app) return 'Pending';
    if (staleStatuses) return 'Stale' as AppPhase;
    return computeAggregatePhase(app.components, statusByName, app.phase);
  }, [app, staleStatuses, statusByName]);

  // kn-fd5: hide the drift banner + pill during the initial ArgoCD reconcile
  // window after app creation. `clock` ticks every 5 s so the suppression
  // expires on its own without a manual refresh once the window is up.
  const initialSyncSuppressed = useMemo(
    () => isInitialSyncWindow(app, appSync, statusByName, clock),
    [app, appSync, statusByName, clock],
  );

  // kn-s3n: pause/resume header buttons appear based on the live replica
  // counts in workload_spec. Show Pause if any workload is running (>0);
  // show Resume if any workload is suspended (=0). Apps with no workload
  // components see neither — there's nothing to scale.
  const workloadReplicaSummary = useMemo(() => {
    if (!app) return { running: 0, paused: 0 };
    let running = 0;
    let paused = 0;
    for (const component of app.components) {
      if (!isWorkloadType(component.type)) continue;
      const r = readReplicaCount(component);
      if (r === null) continue;
      if (r > 0) running++;
      else paused++;
    }
    return { running, paused };
  }, [app]);

  const saveComponentPatch = useCallback(
    (componentName: string) => {
      const draft = envDrafts[componentName];
      if (!draft) return;

      let resources: Record<string, unknown> | undefined;
      let values: Record<string, unknown> | undefined;
      try {
        resources = parseObjectJson(draft.resourcesJson, 'resources');
        values = parseObjectJson(draft.paramsJson, 'params');
      } catch (error) {
        toast({
          title: 'Invalid JSON',
          description: error instanceof Error ? error.message : 'Invalid JSON payload',
          variant: 'error',
        });
        return;
      }

      let parsedPort: number | undefined;
      if (draft.port.trim()) {
        const num = Number(draft.port);
        if (!Number.isInteger(num) || num < 1 || num > 65535) {
          toast({ title: 'Invalid port', description: 'Port must be 1-65535', variant: 'error' });
          return;
        }
        parsedPort = num;
      }

      if (draft.ingressEnabled && !draft.ingressHost.trim()) {
        toast({
          title: 'Ingress host required',
          description: 'Provide a host when ingress is enabled.',
          variant: 'error',
        });
        return;
      }

      // kn-a8t: PATCH wants the snake_case TemplateComponent.EnvVar shape.
      // Read-only export_ref rows (managed via Attach addon) must round-trip
      // back so the backend doesn't drop them when it replaces the env array.
      const env = draft.env
        .map((entry) => {
          const name = entry.name.trim();
          if (!name) return null;
          if (entry.exportRef) {
            return {
              name,
              export_ref: {
                component: entry.exportRef.component,
                export_key: entry.exportRef.exportKey,
              },
            };
          }
          const base: Record<string, unknown> = { name, value: entry.value ?? '' };
          if (entry.secret) base.secret = true;
          return base;
        })
        .filter((entry): entry is Record<string, unknown> => entry !== null);

      const workloadSpec: Record<string, unknown> = { replicas: draft.replicas };
      if (draft.image.trim()) workloadSpec.image = draft.image.trim();
      if (parsedPort !== undefined) workloadSpec.port = parsedPort;
      if (env.length > 0) workloadSpec.env = env;
      if (draft.ingressEnabled) {
        workloadSpec.ingress = { enabled: true, host: draft.ingressHost.trim(), path: draft.ingressPath.trim() || '/' };
      }
      if (resources && Object.keys(resources).length > 0) workloadSpec.resources = resources;
      if (values && Object.keys(values).length > 0) workloadSpec.values = values;

      const payload: AppComponent = { name: componentName, type: 'workload', workload_spec: workloadSpec };
      if (draft.dependsOn.length > 0) payload.depends_on = draft.dependsOn;

      setSavingComponent(componentName);
      setPatchConflict(null);
      patchMutation.mutate(
        { components: [payload] },
        {
          onSuccess: () => {
            setSavingComponent(null);
            setPatchConflict(null);
            toast({ title: 'App updated', description: `Patched component ${componentName}.` });
          },
          onError: (error: unknown) => {
            setSavingComponent(null);
            const conflict = parseGitOpsConflict(error);
            if (conflict) {
              setPatchConflict(conflict);
              if (conflict.sync) {
                setAppSync(conflict.sync);
              }
              toast({
                title: 'GitOps conflict',
                description: conflict.message,
                variant: 'error',
              });
              return;
            }
            toast({ title: 'Patch failed', description: errorMessage(error), variant: 'error' });
          },
        },
      );
    },
    [envDrafts, patchMutation, toast],
  );

  const handleRedeploy = () => {
    redeploy.mutate(undefined, {
      onSuccess: (res) => toast({ title: 'Redeploy triggered', description: res.message }),
      onError: (error: Error) => toast({ title: 'Redeploy failed', description: error.message, variant: 'error' }),
    });
  };

  const handleDelete = () => {
    deleteApp.mutate(
      { namespace, name, projectId },
      {
        onSuccess: () => {
          toast({ title: 'App deleted' });
          router.push('/apps');
        },
        onError: (error: Error) => toast({ title: 'Delete failed', description: error.message, variant: 'error' }),
      },
    );
  };

  const handlePause = () => {
    pauseApp.mutate(undefined, {
      onSuccess: () => toast({ title: 'App paused', description: 'All workloads suspended.' }),
      onError: (error: Error) => toast({ title: 'Pause failed', description: error.message, variant: 'error' }),
    });
  };

  const handleResume = () => {
    resumeApp.mutate(undefined, {
      onSuccess: () => toast({ title: 'App resumed', description: 'Workloads restored from snapshot.' }),
      onError: (error: Error) => toast({ title: 'Resume failed', description: error.message, variant: 'error' }),
    });
  };

  if (!projectId) {
    return (
      <div className="px-6 py-8 max-w-[900px] mx-auto">
        <Card>
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>Missing project_id. Open this app from the Apps list.</p>
        </Card>
      </div>
    );
  }
  if (appQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-3)' }} />
      </div>
    );
  }
  if (appQuery.isError || !app) {
    return (
      <div className="px-6 py-8 max-w-[900px] mx-auto">
        <Card><p className="text-[13px]" style={{ color: 'var(--text-3)' }}>App not found.</p></Card>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 max-w-[1280px] mx-auto">
      <Link href="/apps" className="inline-flex items-center gap-1.5 text-[12.5px] mb-4 hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>
        <ArrowLeft size={13} /> Apps
      </Link>

      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-semibold tracking-tight truncate" style={{ color: 'var(--text)' }}>{app.name}</h1>
            <PhaseBadge phase={aggregatePhase} pulsing={!staleStatuses && sse.connected} />
            {app.template_id ? <Pill tone="accent" size="sm">via template: {app.template_id}</Pill> : null}
            {appSync?.driftDetected && !initialSyncSuppressed ? (
              <Pill
                tone={appSync.driftClass === 'blocked_sync' ? 'err' : 'warn'}
                size="sm"
                data-testid="app-drift-badge"
              >
                drift {appSync.driftClass === 'blocked_sync' ? '(blocked)' : '(recoverable)'}
              </Pill>
            ) : null}
            {initialSyncSuppressed ? (
              <Pill tone="info" size="sm" data-testid="app-initial-sync-badge">
                <Loader2 className="h-3 w-3 animate-spin" /> Syncing
              </Pill>
            ) : null}
          </div>
          <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            {project?.name ?? namespace}
            {cluster ? <> · {cluster.name}</> : null}
            {app.created_at ? <> · created {format(new Date(app.created_at), 'MMM d, yyyy')}</> : null}
          </p>
          <div className="text-[11.5px] flex items-center gap-3 flex-wrap" style={{ color: 'var(--text-3)' }}>
            {sse.reconnecting ? (
              <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--warn)' }} data-testid="app-sse-reconnecting">
                <Loader2 className="h-3 w-3 animate-spin" /> reconnecting...
              </span>
            ) : sse.connected ? (
              <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ok)' }}>
                <CheckCircle2 className="h-3 w-3" /> live updates
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> live stream unavailable</span>
            )}
            {fallbackPollingActive ? <span className="inline-flex items-center gap-1.5"><RotateCw className="h-3 w-3" /> polling fallback active</span> : null}
            {staleStatuses ? (
              <span className="inline-flex items-center gap-1.5" data-testid="app-status-stale"><AlertCircle className="h-3 w-3" /> statuses are stale</span>
            ) : null}
          </div>
          {app.message ? (
            <p className="text-[11.5px] rounded px-2 py-1 mt-1 inline-block" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>{app.message}</p>
          ) : null}
          {statusError ? (
            <p className="text-[11.5px] rounded px-2 py-1 mt-1 inline-block" style={{ background: 'var(--err-soft)', color: 'var(--err)' }}>status refresh error: {statusError}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Btn variant="default" size="sm" icon={RotateCw} onClick={() => void refreshViaPoll()} disabled={syncMutation.isPending}>Refresh</Btn>
          {workloadReplicaSummary.running > 0 && (
            <Btn
              variant="default"
              size="sm"
              icon={PauseCircle}
              onClick={handlePause}
              disabled={pauseApp.isPending}
              data-testid="header-pause-app"
            >
              {pauseApp.isPending ? 'Pausing…' : 'Pause'}
            </Btn>
          )}
          {workloadReplicaSummary.paused > 0 && (
            <Btn
              variant="default"
              size="sm"
              icon={PlayCircle}
              onClick={handleResume}
              disabled={resumeApp.isPending}
              data-testid="header-resume-app"
            >
              {resumeApp.isPending ? 'Resuming…' : 'Resume'}
            </Btn>
          )}
          <Btn
            variant="default"
            size="sm"
            icon={Layers}
            onClick={() => setSaveAsTemplateOpen(true)}
            data-testid="header-save-as-template"
          >
            Save as template
          </Btn>
          <Btn variant="primary" size="sm" icon={RefreshCw} onClick={handleRedeploy} disabled={redeploy.isPending}>{redeploy.isPending ? 'Redeploying…' : 'Redeploy'}</Btn>
          <Btn variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteOpen(true)}>Delete</Btn>
        </div>
      </div>

      {appSync?.driftDetected && !initialSyncSuppressed ? (
        <DriftSurfaceCard
          sync={appSync}
          refreshing={syncMutation.isPending}
          redeploying={redeploy.isPending}
          onRefresh={() => void refreshViaPoll()}
          onRedeploy={handleRedeploy}
          onRollback={() => setTab('deploys')}
        />
      ) : null}
      {initialSyncSuppressed ? (
        <Card flush data-testid="initial-sync-card" className="mb-4">
          <div className="px-4 py-3 flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--info)' }} />
            <span>
              Initial sync in progress — ArgoCD is applying this app for the first time. The
              transient OutOfSync status will clear once the first reconcile finishes
              (typically 30–60 s).
            </span>
          </div>
        </Card>
      ) : null}

      <TabBar tab={tab} setTab={setTab} />

      {tab === 'overview' && (
        <OverviewTab
          components={app.components}
          statuses={statusByName}
          stale={staleStatuses}
          live={!staleStatuses && sse.connected}
          deployRows={deploymentsPreview.data?.data ?? []}
          deployLoading={deploymentsPreview.isLoading}
          namespace={namespace}
          name={name}
          projectId={projectId}
          onAddComponent={() => setAddComponentOpen(true)}
          onRemoveComponent={(c) => setRemoveTarget(c)}
          onAttachAddon={() => setAttachAddonOpen(true)}
          addonInstances={addonInstances}
          onDetachAddon={(req) => setDetachTarget(req)}
          onScaleComponent={(req) => setScaleTarget(req)}
        />
      )}
      {tab === 'deploys' && (
        <DeploymentsTab
          namespace={namespace}
          name={name}
          projectId={projectId}
          components={app.components}
          componentStatuses={statusByName}
          live={!staleStatuses && sse.connected}
          stale={staleStatuses}
          onRedeploy={handleRedeploy}
          redeploying={redeploy.isPending}
        />
      )}
      {tab === 'env' && (
        <EnvironmentPatchTab
          components={app.components}
          drafts={envDrafts}
          onDraftChange={(componentName, nextDraft) => setEnvDrafts((prev) => ({ ...prev, [componentName]: nextDraft }))}
          onSave={saveComponentPatch}
          savingComponent={savingComponent}
          patchPending={patchMutation.isPending}
          conflict={patchConflict}
          onClearConflict={() => setPatchConflict(null)}
        />
      )}
      {tab === 'logs' && <LogsTab namespace={namespace} name={name} projectId={projectId} components={app.components} />}
      {tab === 'settings' && (
        <SettingsTab
          appName={app.name}
          namespace={namespace}
          projectId={projectId}
          templateId={app.template_id ?? null}
          onRefresh={() => void refreshViaPoll()}
          onRedeploy={handleRedeploy}
          refreshing={syncMutation.isPending}
          redeploying={redeploy.isPending}
          components={app.components}
          drafts={envDrafts}
          onDraftChange={(componentName, nextDraft) => setEnvDrafts((prev) => ({ ...prev, [componentName]: nextDraft }))}
          onSave={saveComponentPatch}
          savingComponent={savingComponent}
          patchPending={patchMutation.isPending}
        />
      )}
      {tab === 'monitoring' && <AppMonitoring namespace={namespace} name={name} projectId={projectId} />}

      <AddComponentDrawer
        open={addComponentOpen}
        onClose={() => setAddComponentOpen(false)}
        isPending={addComponent.isPending}
        existingComponents={app.components}
        existingNames={app.components.map((c) => c.name)}
        onAdd={async (component) => {
          await addComponent.mutateAsync(component);
          toast({
            title: 'Component added',
            description: `${component.name} is being deployed.`,
          });
        }}
      />

      <RemoveComponentDialog
        open={removeTarget !== null}
        componentName={removeTarget?.name ?? null}
        componentType={
          removeTarget ? (removeTarget.type === 'addon' ? 'addon' : 'workload') : null
        }
        allComponents={app.components}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async (name) => {
          await removeComponent.mutateAsync(name);
          toast({
            title: 'Component removed',
            description: `${name} has been deleted from this app.`,
          });
        }}
      />

      <AttachAddonDrawer
        open={attachAddonOpen}
        onClose={() => setAttachAddonOpen(false)}
        isPending={attachAddon.isPending}
        projectId={projectId}
        workloadComponents={app.components.filter((c) => isWorkloadType(c.type))}
        onAttach={async (vars) => {
          await attachAddon.mutateAsync(vars);
          toast({
            title: 'Addon attached',
            description: `${vars.envMappings.length} env var${vars.envMappings.length === 1 ? '' : 's'} wired into this app.`,
          });
        }}
      />

      <ScaleComponentDialog
        open={scaleTarget !== null}
        componentName={scaleTarget?.name ?? null}
        currentReplicas={scaleTarget?.currentReplicas ?? null}
        isPending={scaleApp.isPending}
        onClose={() => setScaleTarget(null)}
        onSubmit={async (replicas) => {
          if (!scaleTarget) return;
          const componentName = scaleTarget.name;
          await scaleApp.mutateAsync({ componentName, replicas });
          toast({
            title: `Scaled ${componentName}`,
            description: `Now running ${replicas} replica${replicas === 1 ? '' : 's'}.`,
          });
        }}
      />

      <SaveAsTemplateDialog
        open={saveAsTemplateOpen}
        appName={app.name}
        isPending={saveAsTemplate.isPending}
        onClose={() => setSaveAsTemplateOpen(false)}
        onSubmit={async (data) => {
          const result = await saveAsTemplate.mutateAsync({
            project_id: projectId,
            namespace,
            name,
            data,
          });
          toast({
            title: 'Template saved',
            description: `${result.name} is in your /stacks gallery.`,
          });
          // Jump to the gallery so the user sees the new card. The mutation
          // already invalidated ['stack-templates'], so the list will be fresh.
          router.push('/stacks');
        }}
      />

      {detachTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh]"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => !detachAddon.isPending && setDetachTarget(null)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 480 }}
            className="rounded-xl border anim-slide-up p-4"
            role="dialog"
            aria-label={`Detach addon ${detachTarget.addonComponentName}`}
            data-testid="detach-addon-dialog"
          >
            <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Detach {detachTarget.addonComponentName}?
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-3)' }}>
              This removes {detachTarget.envVarCount} env var{detachTarget.envVarCount === 1 ? '' : 's'} that {detachTarget.workloadName} reads from <span className="font-medium" style={{ color: 'var(--text-2)' }}>{detachTarget.addonComponentName}</span>. The addon instance itself is left running.
            </p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setDetachTarget(null)} disabled={detachAddon.isPending}>Cancel</Btn>
              <Btn
                variant="danger"
                size="sm"
                disabled={detachAddon.isPending}
                onClick={() => {
                  const id = detachTarget.addonInstanceId;
                  const displayName = detachTarget.addonComponentName;
                  detachAddon.mutate(id, {
                    onSuccess: () => {
                      setDetachTarget(null);
                      toast({
                        title: 'Addon detached',
                        description: `Env vars referencing ${displayName} removed from this app.`,
                      });
                    },
                    onError: (err: Error) => {
                      toast({
                        title: 'Detach failed',
                        description: err.message,
                        variant: 'error',
                      });
                    },
                  });
                }}
                data-testid="detach-addon-confirm"
              >
                {detachAddon.isPending ? 'Detaching…' : 'Detach'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 480 }}
            className="rounded-xl border anim-slide-up p-4"
            role="dialog"
            aria-label="Delete app"
          >
            <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Delete app</div>
            <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-3)' }}>
              Delete <span className="font-medium" style={{ color: 'var(--text-2)' }}>{app.name}</span>? This tears down the StackDeploy and all components in <span className="font-mono">{namespace}</span>. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleteApp.isPending}>Cancel</Btn>
              <Btn variant="danger" size="sm" onClick={handleDelete} disabled={deleteApp.isPending}>{deleteApp.isPending ? 'Deleting…' : 'Delete'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriftSurfaceCard({
  sync,
  refreshing,
  redeploying,
  onRefresh,
  onRedeploy,
  onRollback,
}: {
  sync: SyncDriftStatus;
  refreshing: boolean;
  redeploying: boolean;
  onRefresh: () => void;
  onRedeploy: () => void;
  onRollback: () => void;
}) {
  const driftClass = sync.driftClass ?? 'recoverable';
  const blocked = driftClass === 'blocked_sync';
  const details = Array.isArray(sync.driftDetails) ? sync.driftDetails : [];

  return (
    <Card flush data-testid="drift-surface" className="mb-4">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="text-[13.5px] font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <AlertCircle className="h-3.5 w-3.5" style={{ color: blocked ? 'var(--err)' : 'var(--warn)' }} />
            GitOps drift detected
            <Pill tone={blocked ? 'err' : 'warn'} size="sm" data-testid="drift-class-pill">
              {blocked ? 'blocked sync' : 'recoverable drift'}
            </Pill>
          </div>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            Desired: <span className="font-medium" style={{ color: 'var(--text-2)' }}>{sync.desired ?? 'unknown'}</span>
            {' · '}
            Observed: <span className="font-medium" style={{ color: 'var(--text-2)' }}>{sync.observed ?? 'unknown'}</span>
            {sync.lastSyncRevision ? <> · revision <span className="font-mono">{sync.lastSyncRevision.slice(0, 12)}</span></> : null}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Btn variant="default" size="sm" icon={RotateCw} onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Re-syncing…' : 'Re-sync status'}
          </Btn>
          <Btn variant="primary" size="sm" icon={RefreshCw} onClick={onRedeploy} disabled={redeploying}>
            {redeploying ? 'Redeploying…' : 'Redeploy'}
          </Btn>
          <Btn variant="default" size="sm" icon={History} onClick={onRollback}>
            Rollback
          </Btn>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        <p className="text-[12px]" style={{ color: blocked ? 'var(--err)' : 'var(--warn)' }}>
          {blocked
            ? 'Writes are blocked until this git/cluster conflict is reconciled. Use Re-sync, Redeploy, or Rollback.'
            : 'Drift is recoverable. Use safe actions to reconcile desired and observed state.'}
        </p>

        <SectionLabel className="mb-0.5">What differs</SectionLabel>
        {details.length === 0 ? (
          <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            Drift was reported, but no per-resource detail was attached yet.
          </p>
        ) : (
          <div className="space-y-2">
            {details.map((detail, index) => (
              <div
                key={`${detail.resource ?? 'resource'}-${detail.field ?? 'field'}-${index}`}
                className="rounded-md px-3 py-2"
                style={{ border: '1px solid var(--border)' }}
                data-testid="drift-detail-row"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>
                    {detail.resource ?? 'resource'}
                  </span>
                  {detail.field ? <span className="text-[11px] font-mono" style={{ color: 'var(--text-3)' }}>{detail.field}</span> : null}
                  {detail.blocked ? <Pill tone="err" size="sm">blocked</Pill> : <Pill tone="warn" size="sm">recoverable</Pill>}
                </div>
                {detail.reason ? (
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{detail.reason}</p>
                ) : null}
                <div className="grid gap-2 md:grid-cols-2 mt-2">
                  <div className="rounded px-2 py-1.5" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[10.5px] mb-1" style={{ color: 'var(--text-3)' }}>Desired</p>
                    <pre className="text-[10.5px] whitespace-pre-wrap break-all font-mono" style={{ color: 'var(--text-2)' }}>{formatDriftValue(detail.desired)}</pre>
                  </div>
                  <div className="rounded px-2 py-1.5" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[10.5px] mb-1" style={{ color: 'var(--text-3)' }}>Observed</p>
                    <pre className="text-[10.5px] whitespace-pre-wrap break-all font-mono" style={{ color: 'var(--text-2)' }}>{formatDriftValue(detail.observed)}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function OverviewTab({
  components,
  statuses,
  stale,
  live,
  deployRows,
  deployLoading,
  namespace,
  name,
  projectId,
  onAddComponent,
  onRemoveComponent,
  onAttachAddon,
  addonInstances,
  onDetachAddon,
  onScaleComponent,
}: {
  components: AppReadComponent[];
  statuses: Record<string, LiveComponentStatus>;
  stale: boolean;
  live: boolean;
  deployRows: DeploymentRecord[];
  deployLoading: boolean;
  namespace: string;
  name: string;
  projectId: string;
  /** Opens the add-component drawer (kn-a4l). */
  onAddComponent: () => void;
  /** Opens the remove-component confirmation dialog for the given row (kn-fxe). */
  onRemoveComponent: (component: AppReadComponent) => void;
  /** Opens the attach-addon drawer (kn-gfa). */
  onAttachAddon: () => void;
  /** Project-scoped addon instances — used to resolve linked addon chips → instance id. */
  addonInstances: AddonInstance[];
  /** Opens the detach-addon confirmation dialog for the given linked addon (kn-gfa). */
  onDetachAddon: (req: {
    addonInstanceId: string;
    addonComponentName: string;
    workloadName: string;
    envVarCount: number;
  }) => void;
  /** Opens the scale dialog for a workload component (kn-s3n). */
  onScaleComponent: (req: { name: string; currentReplicas: number | null }) => void;
}) {
  const recent = deployRows.slice(0, 5);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card flush>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Live component status</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Per component (workloads & add-ons) — never pod names</div>
        </div>
        <div className="p-3 space-y-2">
          {components.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>No components.</p>
          ) : (
            components.map((component) => {
              const liveStatus = statuses[component.name];
              const shownPhase = stale ? 'Stale' : liveStatus?.phase ?? 'Pending';
              // kn-fxe: only offer Remove when there's more than one component
              // (the backend rejects the last one with 422 anyway). The icon
              // sits next to the phase badge in muted style to avoid accidents.
              const canRemove = components.length > 1;
              // kn-s3n: per-row Scale button on workload components; addons
              // don't have a replica count so they don't get one.
              const isWorkload = isWorkloadType(component.type);
              const componentReplicas = isWorkload ? readReplicaCount(component) : null;
              const isPaused = isWorkload && componentReplicas === 0;
              // kn-gfa: linked-addon chips render under workload rows when an
              // env var imports via export_ref. Groups are by referenced
              // component name so the detach button can target an addon
              // instance, not an individual env var.
              const linkedAddons: LinkedAddonGroup[] = isWorkload
                ? linkedAddonGroupsFor(component, addonInstances)
                : [];
              return (
                <div
                  key={component.name}
                  className="rounded-md px-3 py-2 space-y-1.5"
                  style={{ border: '1px solid var(--border)' }}
                  data-testid={`component-status-row-${component.name}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <ComponentIcon type={component.type} />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{component.name}</p>
                        <p className="text-[10.5px] capitalize" style={{ color: 'var(--text-3)' }}>{component.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        {liveStatus?.health || liveStatus?.sync ? (
                          <p className="text-[10.5px] mb-1" style={{ color: 'var(--text-3)' }}>
                            {liveStatus?.health ?? '—'}{liveStatus?.sync ? ` · ${liveStatus.sync}` : ''}
                          </p>
                        ) : null}
                        {isPaused ? (
                          <Pill tone="warn" size="sm" data-testid={`component-paused-badge-${component.name}`}>
                            Paused
                          </Pill>
                        ) : (
                          <PhaseBadge phase={shownPhase} pulsing={!stale && live && Boolean(liveStatus)} />
                        )}
                      </div>
                      {isWorkload && (
                        <button
                          type="button"
                          onClick={() => onScaleComponent({ name: component.name, currentReplicas: componentReplicas })}
                          data-testid={`component-scale-${component.name}`}
                          title={`Scale ${component.name}${componentReplicas !== null ? ` (currently ${componentReplicas})` : ''}`}
                          aria-label={`Scale ${component.name}`}
                          className="h-7 w-7 rounded-md flex items-center justify-center hover:text-[var(--accent)] transition-colors"
                          style={{ color: 'var(--text-4)' }}
                        >
                          <Sliders className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => onRemoveComponent(component)}
                          data-testid={`component-remove-${component.name}`}
                          title={`Remove ${component.name}`}
                          aria-label={`Remove ${component.name}`}
                          className="h-7 w-7 rounded-md flex items-center justify-center hover:text-[var(--err)] transition-colors"
                          style={{ color: 'var(--text-4)' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {linkedAddons.length > 0 && (
                    <div
                      className="flex flex-wrap items-center gap-1.5 pt-1"
                      style={{ borderTop: '1px dashed var(--border)' }}
                      data-testid={`component-linked-addons-${component.name}`}
                    >
                      <span className="text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                        Linked
                      </span>
                      {linkedAddons.map((group) => (
                        <span
                          key={group.componentName}
                          className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[10.5px] font-mono"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                          title={group.envVars.map((e) => `${e.envVarName} ← ${e.exportKey}`).join('\n')}
                          data-testid={`component-linked-addon-${component.name}-${group.componentName}`}
                        >
                          <Link2 className="h-3 w-3" />
                          {group.componentName}
                          <span style={{ color: 'var(--text-3)' }}>
                            ({group.envVars.length})
                          </span>
                          {group.addonInstanceId ? (
                            <button
                              type="button"
                              onClick={() => onDetachAddon({
                                addonInstanceId: group.addonInstanceId!,
                                addonComponentName: group.componentName,
                                workloadName: component.name,
                                envVarCount: group.envVars.length,
                              })}
                              className="hover:opacity-70 ml-0.5"
                              title={`Detach ${group.componentName}`}
                              aria-label={`Detach ${group.componentName} from ${component.name}`}
                              data-testid={`component-detach-${component.name}-${group.componentName}`}
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {/*
            kn-a4l + kn-gfa: dashed-border affordances at the bottom of the
            list. Add-a-component creates a brand-new StackDeploy component;
            Attach-an-addon wires env vars from an addon that already exists
            in this project (without making it a component of this app).
          */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onAddComponent}
              data-testid="overview-add-component"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border-2 border-dashed text-[12.5px] hover:opacity-80 transition-opacity"
              style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
            >
              <Plus className="h-3.5 w-3.5" /> Add a component
            </button>
            <button
              type="button"
              onClick={onAttachAddon}
              data-testid="overview-attach-addon"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border-2 border-dashed text-[12.5px] hover:opacity-80 transition-opacity"
              style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
            >
              <Database className="h-3.5 w-3.5" /> Attach an addon
            </button>
          </div>
        </div>
      </Card>

      <Card flush>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Recent deploys</div>
        </div>
        <div className="p-3">
          {deployLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--text-3)' }} />
          ) : recent.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>No deployments yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((row) => (
                <div key={row.id} className="rounded-md px-3 py-2" style={{ border: '1px solid var(--border)' }}>
                  <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{row.description}</p>
                  <p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{format(new Date(row.created_at), 'MMM d, HH:mm')} · {String(row.status).toLowerCase()}</p>
                </div>
              ))}
              <p className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>Open the Deploys tab for the full timeline, redeploy and rollback.</p>
            </div>
          )}
        </div>
      </Card>

      <div className="md:col-span-2">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Resource graphs</SectionLabel>
            <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>last hour · full graphs on the Monitoring tab</span>
          </div>
          <AppMonitoring namespace={namespace} name={name} projectId={projectId} compact />
        </Card>
      </div>
    </div>
  );
}

const DEPLOY_STATUS_TONE: Record<string, PillTone> = {
  completed: 'ok',
  failed: 'err',
  in_progress: 'info',
  pending: 'info',
};
const DEPLOY_STATUS_DOT: Record<string, string> = {
  completed: 'var(--ok)',
  failed: 'var(--err)',
  in_progress: 'var(--info)',
  pending: 'var(--info)',
};
const IN_FLIGHT_PHASES = new Set(['Pending', 'Deploying', 'Building', 'Progressing']);

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(d / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DeploymentsTab({
  namespace,
  name,
  projectId,
  components,
  componentStatuses,
  live,
  stale,
  onRedeploy,
  redeploying,
}: {
  namespace: string;
  name: string;
  projectId: string;
  components: AppReadComponent[];
  componentStatuses: Record<string, LiveComponentStatus>;
  live: boolean;
  stale: boolean;
  onRedeploy: () => void;
  redeploying: boolean;
}) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;
  const deployments = useAppDeployments(namespace, name, projectId, page, itemsPerPage);
  const rollback = useRollbackApp(namespace, name, projectId);

  const [rollbackTarget, setRollbackTarget] = useState<DeploymentRecord | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [rolledBackTo, setRolledBackTo] = useState<DeploymentRecord | null>(null);

  const workloadComponents = useMemo(() => components.filter((c) => isWorkloadType(c.type)), [components]);
  const someComponentInFlight =
    !stale && workloadComponents.some((c) => IN_FLIGHT_PHASES.has(componentStatuses[c.name]?.phase ?? ''));
  const progressing = redeploying || rollback.isPending || someComponentInFlight;

  const doRollback = (row: DeploymentRecord) => {
    setRollbackError(null);
    rollback.mutate(row.id, {
      onSuccess: () => {
        setRolledBackTo(row);
        setRollbackTarget(null);
        toast({ title: 'Rollback started', description: `Re-applying the spec from "${row.description || 'that deploy'}".` });
      },
      onError: (error: Error) => {
        setRollbackError(error.message || 'Rollback failed');
        setRollbackTarget(null);
        toast({ title: 'Rollback failed', description: error.message, variant: 'error' });
      },
    });
  };

  const rows = deployments.data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((deployments.data?.total_count ?? 0) / itemsPerPage));

  return (
    <div className="space-y-4">
      <Card flush>
        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-[13.5px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
              <History className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} /> Deploy timeline
            </div>
            <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
              Real deploys — sha, description, status, timestamps.{' '}
              <span style={{ color: 'var(--text-4)' }}>Deploy #, duration, commit author/branch and diff stats arrive with kn-B10.</span>
            </div>
          </div>
          <Btn variant="primary" size="sm" icon={RefreshCw} onClick={onRedeploy} disabled={redeploying} data-testid="deploys-redeploy">
            {redeploying ? 'Redeploying…' : 'Redeploy'}
          </Btn>
        </div>

        {progressing && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--info-soft)' }} data-testid="deploy-progress">
            <div className="text-[12px] font-medium flex items-center gap-1.5 mb-2" style={{ color: 'var(--info)' }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {rollback.isPending ? 'Rolling back…' : 'Deploy in progress…'}
              <span className="text-[10.5px] font-normal" style={{ color: 'var(--text-3)' }}>· {live ? 'live via SSE' : 'polling'}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {workloadComponents.length === 0 ? (
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>no workload components</span>
              ) : (
                workloadComponents.map((c) => {
                  const ph = stale ? 'Stale' : componentStatuses[c.name]?.phase ?? 'Pending';
                  return (
                    <span key={c.name} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-2)' }}>
                      <span className="font-mono">{c.name}</span>
                      <PhaseBadge phase={ph} pulsing={!stale && live} />
                    </span>
                  );
                })
              )}
            </div>
          </div>
        )}

        {rollbackError && (
          <div className="px-4 py-3 text-[12px]" style={{ borderBottom: '1px solid var(--border)', background: 'var(--err-soft)', color: 'var(--err)' }} data-testid="rollback-error">
            <div className="font-medium flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Rollback failed</div>
            <p className="mt-0.5">{rollbackError} — the app’s current spec is unchanged. Retry, or pick another deploy below.</p>
          </div>
        )}
        {rolledBackTo && !rollbackError && !rollback.isPending && (
          <div className="px-4 py-3 text-[12px]" style={{ borderBottom: '1px solid var(--border)', background: 'var(--ok-soft)', color: 'var(--ok)' }}>
            <span className="font-medium">Rolled back</span> to “{rolledBackTo.description || 'a prior deploy'}”. Watch the component status above settle to Running.
          </div>
        )}

        {deployments.isLoading ? (
          <div className="py-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>No deploys yet — redeploy to create the first timeline entry.</div>
        ) : (
          <div>
            {rows.map((row) => {
              const st = String(row.status).toLowerCase();
              const failed = st === 'failed';
              // kn-m1i: rolling back while a deploy is still in flight is
              // undefined behaviour — the operator would race itself between
              // the in-progress reconcile and the rollback re-apply. Block
              // the action at the source (button disabled + explanatory tooltip)
              // rather than letting the user trigger it and then surfacing a
              // backend error after the round-trip.
              const rowActive = st === 'in_progress' || st === 'pending';
              const rollbackDisabled = rollback.isPending || rowActive;
              const rollbackTitle = rowActive
                ? 'Cannot roll back while a deploy is in progress'
                : row.prior_state
                  ? 'Re-apply the spec captured by this deploy'
                  : 'Roll the app back to this point (the operator re-applies the prior spec)';
              return (
                <div key={row.id} className="flex items-start justify-between py-3 px-4 gap-4" style={{ borderTop: '1px solid var(--border)' }} data-testid="deploy-row">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: DEPLOY_STATUS_DOT[st] ?? 'var(--text-3)' }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[12.5px] font-medium truncate" style={{ color: failed ? 'var(--err)' : 'var(--text)' }}>{row.description || '(deploy)'}</p>
                        <Pill tone={DEPLOY_STATUS_TONE[st] ?? 'default'} size="sm">{st.replace('_', ' ')}</Pill>
                      </div>
                      <p className="text-[10.5px] mt-0.5 font-mono" style={{ color: 'var(--text-3)' }}>
                        {row.sha ? `${row.sha.slice(0, 12)} · ` : ''}{row.triggered_by} · {relTime(row.created_at)}{row.completed_at ? ` · done ${relTime(row.completed_at)}` : ''}
                      </p>
                      {row.error_message && <p className="text-[10.5px] mt-1 font-mono" style={{ color: 'var(--err)' }}>{row.error_message}</p>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Btn
                      variant="default"
                      size="sm"
                      disabled={rollbackDisabled}
                      onClick={() => setRollbackTarget(row)}
                      data-testid="deploy-rollback"
                      data-row-active={rowActive ? 'true' : undefined}
                      title={rollbackTitle}
                      aria-disabled={rollbackDisabled || undefined}
                    >
                      Roll back to this
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 py-2 px-4 text-[11.5px]" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
            <Btn variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Btn>
            <span>{page} / {totalPages}</span>
            <Btn variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
          </div>
        ) : null}
      </Card>

      {rollbackTarget && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[16vh]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setRollbackTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-xl border anim-slide-up p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 460 }} role="dialog" aria-label="Roll back">
            <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Roll back this app</div>
            <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-3)' }}>
              Re-apply the spec from <span className="font-medium" style={{ color: 'var(--text-2)' }}>“{rollbackTarget.description || 'this deploy'}”</span>
              {rollbackTarget.sha ? <> (<span className="font-mono">{rollbackTarget.sha.slice(0, 12)}</span>)</> : null}? The operator re-applies it idempotently; component status moves back through Deploying → Running.
            </p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setRollbackTarget(null)} disabled={rollback.isPending}>Cancel</Btn>
              <Btn variant="primary" size="sm" onClick={() => doRollback(rollbackTarget)} disabled={rollback.isPending} data-testid="rollback-confirm">{rollback.isPending ? 'Rolling back…' : 'Roll back'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EnvironmentPatchTab({
  components,
  drafts,
  onDraftChange,
  onSave,
  savingComponent,
  patchPending,
  conflict,
  onClearConflict,
}: {
  components: AppReadComponent[];
  drafts: Record<string, EnvDraft>;
  onDraftChange: (componentName: string, draft: EnvDraft) => void;
  onSave: (componentName: string) => void;
  savingComponent: string | null;
  patchPending: boolean;
  conflict: PatchConflictState | null;
  onClearConflict: () => void;
}) {
  const workloads = useMemo(() => components.filter((component) => isWorkloadType(component.type)), [components]);
  // Derive the active selection from the (possibly-changed) workload list — the
  // user's pick wins while it's still valid, otherwise fall back to the first.
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked && workloads.some((w) => w.name === picked) ? picked : (workloads[0]?.name ?? '');

  if (workloads.length === 0) {
    return <Card><div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>No workload components - env editing unavailable.</div></Card>;
  }

  const draft = active ? drafts[active] ?? defaultEnvDraft() : defaultEnvDraft();
  const updateDraft = (patch: Partial<EnvDraft>) => {
    if (!active) return;
    onDraftChange(active, { ...draft, ...patch });
  };
  const updateEnvRow = (index: number, patch: Partial<EnvRow>) => {
    updateDraft({ env: draft.env.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  };
  const removeEnvRow = (index: number) => {
    const next = draft.env.filter((_, i) => i !== index);
    updateDraft({ env: next.length > 0 ? next : [{ name: '', value: '' }] });
  };
  const addEnvRow = () => updateDraft({ env: [...draft.env, { name: '', value: '' }] });

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          Environment variables and secrets for each component. Workload spec
          (image, replicas, port, ingress, resources, params) lives under{' '}
          <span className="font-medium" style={{ color: 'var(--text-2)' }}>Settings</span>.
        </p>
        {conflict ? (
          <div
            className="mt-3 rounded-md px-3 py-2.5"
            style={{ background: 'var(--err-soft)', border: '1px solid var(--err)', color: 'var(--err)' }}
            data-testid="env-conflict-message"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Concurrent GitOps conflict
              </p>
              <button
                type="button"
                onClick={onClearConflict}
                className="text-[11px] underline underline-offset-2"
                style={{ color: 'var(--err)' }}
              >
                Dismiss
              </button>
            </div>
            <p className="text-[11.5px] mt-1">{conflict.message}</p>
            {conflict.sync?.driftClass === 'blocked_sync' ? (
              <p className="text-[11px] mt-1.5">
                This app is currently <span className="font-medium">blocked_sync</span>. Reconcile from git, redeploy, or roll back first.
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <ComponentPicker components={workloads} active={active} setActive={setPicked} testIdPrefix="env-component" />

      <Card flush>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{active}</div>
          <button type="button" onClick={addEnvRow} className="inline-flex items-center gap-1 text-[11.5px] hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }} data-testid={`env-add-row-${active}`}>
            <Plus className="h-3 w-3" /> Add env var
          </button>
        </div>
        <div className="p-4 space-y-3">
          {draft.env.length === 0 ? (
            <p className="text-[12px] italic" style={{ color: 'var(--text-4)' }}>
              No environment variables yet. Add one above, or attach an addon from the overview tab to inject its exports.
            </p>
          ) : (
            <div className="space-y-2">
              {draft.env.map((row, index) => {
                if (row.exportRef) {
                  // Read-only chip — addon-injected env vars are managed via
                  // the Attach addon drawer, not this editor.
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-md px-2.5 h-8 text-[11.5px]"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                      data-testid={`env-row-export-${row.name}`}
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="font-mono font-medium">{row.name}</span>
                      <span style={{ color: 'var(--text-3)' }}>
                        ← {row.exportRef.exportKey} from {row.exportRef.component}
                      </span>
                      <span className="ml-auto text-[10.5px]" style={{ color: 'var(--text-4)' }}>
                        managed via Attach addon
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={index} className="flex items-center gap-2" data-testid={`env-row-${index}`}>
                    <TInput
                      value={row.name}
                      onChange={(e) => updateEnvRow(index, { name: e.target.value })}
                      placeholder="KEY"
                      className="font-mono"
                    />
                    <TInput
                      type={row.secret ? 'password' : 'text'}
                      value={row.value}
                      onChange={(e) => updateEnvRow(index, { value: e.target.value })}
                      placeholder={row.secret ? '••••••' : 'value'}
                      className="font-mono"
                    />
                    <label
                      className="inline-flex items-center gap-1 text-[10.5px] shrink-0 select-none cursor-pointer"
                      style={{ color: row.secret ? 'var(--accent)' : 'var(--text-4)' }}
                      title={row.secret
                        ? 'Mounted via k8s Secret (envFrom) — value is hidden in pod env'
                        : 'Inline literal in helm values — toggle on to store as a k8s Secret instead'}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(row.secret)}
                        onChange={(e) => updateEnvRow(index, { secret: e.target.checked || undefined })}
                        data-testid={`env-row-secret-${index}`}
                      />
                      Secret
                    </label>
                    <button
                      type="button"
                      onClick={() => removeEnvRow(index)}
                      className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 hover:text-[var(--err)]"
                      style={{ color: 'var(--text-4)' }}
                      aria-label="Remove env var"
                      data-testid={`env-row-remove-${index}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <Btn
              variant="primary"
              size="sm"
              disabled={patchPending}
              onClick={() => onSave(active)}
              data-testid={`env-save-${active}`}
            >
              {patchPending && savingComponent === active ? 'Saving…' : 'Save env vars'}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

function LogsTab({ namespace, name, projectId, components }: { namespace: string; name: string; projectId: string; components: AppReadComponent[] }) {
  const workloads = useMemo(() => components.filter((component) => isWorkloadType(component.type)), [components]);
  // Derived active selection — see EnvTab's ComponentPicker for the same shape.
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked && workloads.some((w) => w.name === picked) ? picked : (workloads[0]?.name ?? '');

  if (workloads.length === 0) {
    return <Card><div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>No workload components - logs unavailable.</div></Card>;
  }

  return (
    <div className="space-y-3">
      <ComponentPicker components={workloads} active={active} setActive={setPicked} testIdPrefix="logs-component" />
      {active ? <LogStream namespace={namespace} name={name} projectId={projectId} component={active} /> : null}
    </div>
  );
}

interface LogLine {
  id: number;
  message: string;
}

function LogStream({ namespace, name, projectId, component }: { namespace: string; name: string; projectId: string; component: string }) {
  const token = useAuthStore((state) => state.token);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const append = useCallback((message: string) => {
    counterRef.current += 1;
    const id = counterRef.current;
    setLines((prev) => {
      const next = [...prev, { id, message }];
      return next.length > 2000 ? next.slice(-2000) : next;
    });
  }, []);

  const connect = useCallback(async () => {
    if (!token) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setConnected(false);
    setLines([]);

    try {
      const response = await fetch(appLogsStreamUrl(namespace, name, projectId, { component, tailLines: 200 }), {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          detail = body.detail || body.message || detail;
        } catch {
          /* ignore non-json bodies */
        }
        setError(detail);
        return;
      }
      if (!response.body) {
        setError('Streaming not supported');
        return;
      }

      setConnected(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';
        for (const line of parts) {
          if (!line.trim() || line.startsWith('event:') || line.startsWith(':')) continue;
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const kind = parsed.type ?? parsed.event;
            const componentLabel = typeof parsed.component === 'string' && parsed.component.length > 0 ? parsed.component : component;
            if (kind === 'connected') {
              append(`[${componentLabel}] stream connected`);
              continue;
            }
            if (kind === 'heartbeat') continue;
            if (kind === 'closed') {
              setConnected(false);
              setError('Stream closed by server');
              return;
            }
            const lineMessage =
              typeof parsed.line === 'string' ? parsed.line : typeof parsed.message === 'string' ? parsed.message : raw;
            append(`[${componentLabel}] ${lineMessage}`);
          } catch {
            append(`[${component}] ${raw}`);
          }
        }
      }
      setConnected(false);
      setError('Stream ended');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setConnected(false);
      setError(error instanceof Error ? error.message : 'Connection failed');
    }
  }, [append, component, name, namespace, projectId, token]);

  // Open the log stream on mount / when the target changes; abort on cleanup.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- connect() opens the SSE stream and resets the buffer; that's the effect's job
    void connect();
    return () => abortRef.current?.abort();
  }, [connect]);

  useEffect(() => {
    if (follow && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [follow, lines]);

  const downloadLogs = () => {
    const blob = new Blob([lines.map((line) => line.message).join('\n')], { type: 'text/plain' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${name}-${component}-${Date.now()}.log`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return (
    <Card flush>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="text-[11.5px]">
          {connected ? (
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ok)' }}>
              <span className="w-1.5 h-1.5 rounded-full breathe" style={{ background: 'var(--ok)' }} /> streaming · {component}
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--err)' }}><AlertCircle className="h-3 w-3" /> {error}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}><Loader2 className="h-3 w-3 animate-spin" /> connecting...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {error ? <Btn variant="ghost" size="sm" onClick={() => void connect()}><RefreshCw className="h-3 w-3 mr-1" /> Retry</Btn> : null}
          <Btn variant="ghost" size="sm" onClick={() => setFollow((prev) => !prev)}>{follow ? <><Pause className="h-3 w-3 mr-1" /> Pause</> : <><Play className="h-3 w-3 mr-1" /> Follow</>}</Btn>
          <Btn variant="ghost" size="sm" onClick={downloadLogs} disabled={lines.length === 0}><Download className="h-3 w-3 mr-1" /> Download</Btn>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="h-[480px] overflow-auto font-mono text-[11px] p-3 leading-relaxed"
        style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
        data-testid="component-log-lines"
      >
        {lines.length === 0 && !error ? (
          <p style={{ color: 'var(--text-3)' }}>Waiting for log lines...</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="whitespace-pre-wrap break-all">{line.message}</div>
          ))
        )}
      </div>
    </Card>
  );
}

function SettingsTab({
  appName,
  namespace,
  projectId,
  templateId,
  onRefresh,
  onRedeploy,
  refreshing,
  redeploying,
  components,
  drafts,
  onDraftChange,
  onSave,
  savingComponent,
  patchPending,
}: {
  appName: string;
  namespace: string;
  projectId: string;
  templateId: string | null;
  onRefresh: () => void;
  onRedeploy: () => void;
  refreshing: boolean;
  redeploying: boolean;
  // kn-a8t: workload-config editor moved here from the Env tab.
  components: AppReadComponent[];
  drafts: Record<string, EnvDraft>;
  onDraftChange: (componentName: string, draft: EnvDraft) => void;
  onSave: (componentName: string) => void;
  savingComponent: string | null;
  patchPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel className="mb-2.5">App settings</SectionLabel>
        <div className="grid gap-2 text-[12px] md:grid-cols-2">
          {([
            ['App', appName],
            ['Namespace', namespace],
            ['Project', projectId],
            ['Template', templateId ?? 'inline app (no template)'],
          ] as const).map(([k, v]) => (
            <div key={k}><span style={{ color: 'var(--text-3)' }}>{k}: </span><span style={{ color: 'var(--text)' }}>{v}</span></div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Btn variant="default" size="sm" icon={RotateCw} onClick={onRefresh} disabled={refreshing}>Refresh status</Btn>
          <Btn variant="primary" size="sm" icon={RefreshCw} onClick={onRedeploy} disabled={redeploying}>{redeploying ? 'Redeploying…' : 'Redeploy now'}</Btn>
        </div>
      </Card>

      <WorkloadConfigEditor
        components={components}
        drafts={drafts}
        onDraftChange={onDraftChange}
        onSave={onSave}
        savingComponent={savingComponent}
        patchPending={patchPending}
      />
    </div>
  );
}

/**
 * kn-a8t: per-workload spec editor (image / replicas / port / ingress /
 * resources / params / depends_on) — relocated out of the Env tab so that
 * tab can be narrowly about env vars + secrets. The save flow reuses the
 * shared EnvDraft pipeline; this editor writes everything BUT `env`, which
 * is owned by EnvironmentPatchTab. Both tabs save through the same
 * `saveComponentPatch` so the PATCH body always carries the full draft.
 */
function WorkloadConfigEditor({
  components,
  drafts,
  onDraftChange,
  onSave,
  savingComponent,
  patchPending,
}: {
  components: AppReadComponent[];
  drafts: Record<string, EnvDraft>;
  onDraftChange: (componentName: string, draft: EnvDraft) => void;
  onSave: (componentName: string) => void;
  savingComponent: string | null;
  patchPending: boolean;
}) {
  const workloads = useMemo(() => components.filter((c) => isWorkloadType(c.type)), [components]);
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked && workloads.some((w) => w.name === picked) ? picked : (workloads[0]?.name ?? '');

  if (workloads.length === 0) {
    return (
      <Card>
        <div className="py-6 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
          No workload components — nothing to configure.
        </div>
      </Card>
    );
  }

  const draft = active ? drafts[active] ?? defaultEnvDraft() : defaultEnvDraft();
  const updateDraft = (patch: Partial<EnvDraft>) => {
    if (!active) return;
    onDraftChange(active, { ...draft, ...patch });
  };

  return (
    <div className="space-y-3">
      <ComponentPicker components={workloads} active={active} setActive={setPicked} testIdPrefix="settings-component" />
      <Card flush>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{active}</div>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            Edit the workload spec. Env vars + secrets are on the Env tab.
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 block">
              <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Image</span>
              <TInput value={draft.image} onChange={(e) => updateDraft({ image: e.target.value })} placeholder="ghcr.io/org/app:tag" data-testid="settings-image" />
            </label>
            <label className="space-y-1 block">
              <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Replicas</span>
              <TInput type="number" min={0} value={draft.replicas} onChange={(e) => { const n = Number(e.target.value); updateDraft({ replicas: Number.isNaN(n) ? 0 : Math.max(0, n) }); }} data-testid="settings-replicas" />
            </label>
            <label className="space-y-1 block">
              <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Port</span>
              <TInput value={draft.port} onChange={(e) => updateDraft({ port: e.target.value })} placeholder="8080" data-testid="settings-port" />
            </label>
            <label className="space-y-1 block">
              <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Depends on (comma-separated)</span>
              <TInput
                value={draft.dependsOn.join(', ')}
                onChange={(e) => updateDraft({ dependsOn: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="postgres"
                data-testid="settings-depends-on"
              />
            </label>
          </div>

          <div className="space-y-2 rounded-md p-3" style={{ border: '1px solid var(--border)' }}>
            <label className="inline-flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
              <input type="checkbox" checked={draft.ingressEnabled} onChange={(e) => updateDraft({ ingressEnabled: e.target.checked })} data-testid="settings-ingress-toggle" />
              Enable ingress
            </label>
            {draft.ingressEnabled ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 block">
                  <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Ingress host</span>
                  <TInput value={draft.ingressHost} onChange={(e) => updateDraft({ ingressHost: e.target.value })} placeholder="app.example.com" data-testid="settings-ingress-host" />
                </label>
                <label className="space-y-1 block">
                  <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Ingress path</span>
                  <TInput value={draft.ingressPath} onChange={(e) => updateDraft({ ingressPath: e.target.value })} placeholder="/" data-testid="settings-ingress-path" />
                </label>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 block">
              <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Resources (JSON object)</span>
              <TTextarea value={draft.resourcesJson} onChange={(e) => updateDraft({ resourcesJson: e.target.value })} className="min-h-28" data-testid="settings-resources" />
            </label>
            <label className="space-y-1 block">
              <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Params / values (JSON object)</span>
              <TTextarea value={draft.paramsJson} onChange={(e) => updateDraft({ paramsJson: e.target.value })} className="min-h-28" data-testid="settings-params" />
            </label>
          </div>

          <div className="flex items-center justify-end">
            <Btn variant="primary" size="sm" disabled={patchPending} onClick={() => onSave(active)} data-testid={`settings-save-${active}`}>
              {patchPending && savingComponent === active ? 'Saving…' : 'Save workload spec'}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

