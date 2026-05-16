import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appsApi } from '@/lib/api/apps';
import type {
  AddonEnvMapping,
  AppComponent,
  AppCreate,
  AppPatch,
  ComponentSecretUpsert,
} from '@/types/api';

export function useApps(params?: { project_id?: string }) {
  const projectId = params?.project_id;
  return useQuery({
    queryKey: ['apps', { project_id: projectId ?? null }],
    queryFn: () => appsApi.list({ project_id: projectId }),
  });
}

export function useApp(namespace: string, name: string, projectId: string) {
  return useQuery({
    queryKey: ['app', namespace, name, projectId],
    queryFn: () => appsApi.get(namespace, name, projectId),
    enabled: !!namespace && !!name && !!projectId,
  });
}

export function useCreateApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AppCreate) => appsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function usePatchApp(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AppPatch) =>
      appsApi.patch(namespace, name, projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

/**
 * Append a new component to a running app (kn-a4l).
 *
 * Thin wrapper around `PATCH /apps/{ns}/{name}` with `add_components` — kept
 * separate from `usePatchApp` so call sites read as add-vs-edit and so the
 * invalidation set can stay scoped to the app + deploy list (no env-draft
 * invalidation needed; the new component seeds its own draft on next render).
 */
export function useAddAppComponent(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (component: AppComponent) =>
      appsApi.patch(namespace, name, projectId, { add_components: [component] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

/**
 * Drop a component from a running app (kn-fxe).
 *
 * Thin wrapper around `PATCH /apps/{ns}/{name}` with
 * `remove_component_names`. The backend validates that at least one
 * component remains and that no remaining component's `export_ref`
 * pointed at the removed one (returns 422 otherwise).
 */
export function useRemoveAppComponent(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (componentName: string) =>
      appsApi.patch(namespace, name, projectId, { remove_component_names: [componentName] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

/**
 * Set replicas on a single workload component (kn-s3n).
 *
 * Thin wrapper around `POST /apps/{ns}/{name}/scale`. Setting `replicas=0`
 * suspends the workload — equivalent to per-component pause. The backend
 * records this as a dedicated `scale` deployment-history action so the
 * activity feed can distinguish scale events from generic patches.
 */
export function useScaleApp(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { componentName: string; replicas: number }) =>
      appsApi.scale(namespace, name, projectId, {
        component_name: vars.componentName,
        replicas: vars.replicas,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

/**
 * Suspend every workload component in the app by setting replicas=0 (kn-s3n).
 * Idempotent — components already at 0 are written back as-is.
 */
export function usePauseApp(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => appsApi.pause(namespace, name, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

/**
 * Restore workload components from a paused snapshot (kn-s3n). Idempotent
 * for already-running components.
 */
export function useResumeApp(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => appsApi.resume(namespace, name, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

/**
 * Wire a standalone addon instance's exports into this app's workload
 * components (kn-gfa). Does NOT add the addon as a StackDeploy component —
 * for that, use `useAddAppComponent` first, then attach.
 */
export function useAttachAddon(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { addonInstanceId: string; envMappings: AddonEnvMapping[] }) =>
      appsApi.attachAddon(namespace, name, projectId, {
        addon_instance_id: vars.addonInstanceId,
        env_mappings: vars.envMappings,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

/**
 * Remove every env var on this app's workload components that exportRefs
 * the given addon instance (kn-gfa). Returns 404 if nothing was attached.
 */
export function useDetachAddon(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addonInstanceId: string) =>
      appsApi.detachAddon(namespace, name, projectId, addonInstanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

export function useDeleteApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { namespace: string; name: string; projectId: string }) =>
      appsApi.delete(vars.namespace, vars.name, vars.projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function useRedeployApp(namespace: string, name: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => appsApi.redeploy(namespace, name, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

export function useSyncAppStatus(
  namespace: string,
  name: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => appsApi.syncStatus(namespace, name, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
    },
  });
}

export function useAppDeployments(
  namespace: string,
  name: string,
  projectId: string,
  page = 1,
  itemsPerPage = 20,
) {
  return useQuery({
    queryKey: ['app-deployments', namespace, name, projectId, page, itemsPerPage],
    queryFn: () =>
      appsApi.listDeployments(namespace, name, projectId, page, itemsPerPage),
    enabled: !!namespace && !!name && !!projectId,
  });
}

export function useRollbackApp(
  namespace: string,
  name: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deploymentId: string) =>
      appsApi.rollbackDeployment(namespace, name, projectId, deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', namespace, name, projectId] });
      queryClient.invalidateQueries({
        queryKey: ['app-deployments', namespace, name, projectId],
      });
    },
  });
}

export function useComponentSecrets(
  namespace: string,
  name: string,
  component: string,
  projectId: string,
) {
  return useQuery({
    queryKey: ['component-secrets', namespace, name, component, projectId],
    queryFn: () =>
      appsApi.listComponentSecrets(namespace, name, component, projectId),
    enabled: !!namespace && !!name && !!component && !!projectId,
  });
}

export function useUpsertComponentSecrets(
  namespace: string,
  name: string,
  component: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ComponentSecretUpsert) =>
      appsApi.upsertComponentSecrets(namespace, name, component, projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['component-secrets', namespace, name, component, projectId],
      });
    },
  });
}

export function useDeleteComponentSecret(
  namespace: string,
  name: string,
  component: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      appsApi.deleteComponentSecret(namespace, name, component, projectId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['component-secrets', namespace, name, component, projectId],
      });
    },
  });
}
