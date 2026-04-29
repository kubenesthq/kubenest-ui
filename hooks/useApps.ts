import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appsApi } from '@/lib/api/apps';
import type {
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
