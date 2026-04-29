import { apiClient } from '../api-client';
import type {
  AppCreate,
  AppList,
  AppPatch,
  AppRead,
  AppRedeployResponse,
  AppStatusResponse,
  ComponentSecretList,
  ComponentSecretUpsert,
  DeploymentListResponse,
} from '@/types/api';

export const appsApi = {
  list: (params?: { project_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.project_id) query.set('project_id', params.project_id);
    const qs = query.toString();
    return apiClient.get<AppList>(`/apps${qs ? `?${qs}` : ''}`);
  },

  get: (namespace: string, name: string, projectId: string) =>
    apiClient.get<AppRead>(
      `/apps/${namespace}/${name}?project_id=${encodeURIComponent(projectId)}`,
    ),

  create: (data: AppCreate) => apiClient.post<AppRead>('/apps', data),

  patch: (namespace: string, name: string, projectId: string, body: AppPatch) =>
    apiClient.patch<AppRead>(
      `/apps/${namespace}/${name}?project_id=${encodeURIComponent(projectId)}`,
      body,
    ),

  delete: (namespace: string, name: string, projectId: string) =>
    apiClient.delete<void>(
      `/apps/${namespace}/${name}?project_id=${encodeURIComponent(projectId)}`,
    ),

  redeploy: (namespace: string, name: string, projectId: string) =>
    apiClient.post<AppRedeployResponse>(
      `/apps/${namespace}/${name}/redeploy?project_id=${encodeURIComponent(projectId)}`,
      {},
    ),

  syncStatus: (namespace: string, name: string, projectId: string) =>
    apiClient.post<AppStatusResponse>(
      `/apps/${namespace}/${name}/sync-status?project_id=${encodeURIComponent(projectId)}`,
      {},
    ),

  listDeployments: (
    namespace: string,
    name: string,
    projectId: string,
    page = 1,
    itemsPerPage = 20,
  ) =>
    apiClient.get<DeploymentListResponse>(
      `/apps/${namespace}/${name}/deployments?project_id=${encodeURIComponent(
        projectId,
      )}&page=${page}&items_per_page=${itemsPerPage}`,
    ),

  rollbackDeployment: (
    namespace: string,
    name: string,
    projectId: string,
    deploymentId: string,
  ) =>
    apiClient.post<AppRead>(
      `/apps/${namespace}/${name}/deployments/${deploymentId}/rollback?project_id=${encodeURIComponent(
        projectId,
      )}`,
      {},
    ),

  listComponentSecrets: (
    namespace: string,
    name: string,
    component: string,
    projectId: string,
  ) =>
    apiClient.get<ComponentSecretList>(
      `/apps/${namespace}/${name}/components/${component}/secrets?project_id=${encodeURIComponent(
        projectId,
      )}`,
    ),

  upsertComponentSecrets: (
    namespace: string,
    name: string,
    component: string,
    projectId: string,
    body: ComponentSecretUpsert,
  ) =>
    apiClient.patch<ComponentSecretList>(
      `/apps/${namespace}/${name}/components/${component}/secrets?project_id=${encodeURIComponent(
        projectId,
      )}`,
      body,
    ),

  deleteComponentSecret: (
    namespace: string,
    name: string,
    component: string,
    projectId: string,
    key: string,
  ) =>
    apiClient.delete<void>(
      `/apps/${namespace}/${name}/components/${component}/secrets/${encodeURIComponent(
        key,
      )}?project_id=${encodeURIComponent(projectId)}`,
    ),
};

export function appLogStreamUrl(
  namespace: string,
  name: string,
  component: string,
  projectId: string,
  tailLines = 200,
) {
  const base =
    typeof window === 'undefined'
      ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      : '';
  return `${base}/api/v1/apps/${namespace}/${name}/components/${component}/logs/stream?project_id=${encodeURIComponent(
    projectId,
  )}&tail_lines=${tailLines}`;
}
