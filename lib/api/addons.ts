import { apiClient } from '../api-client';
import type {
  AddonDefinition,
  AddonDefinitionCreate,
  AddonDefinitionUpdate,
  AddonDefinitionListResponse,
  AddonInstance,
  AddonInstanceCreate,
  AddonInstanceListResponse,
  AddonInstancePatchRequest,
  AddonInstanceRevisionListResponse,
  AddonInstanceRollbackRequest,
  AddonInstanceRollbackResponse,
} from '@/types/api';

export const addonDefinitionsApi = {
  list: (params?: { cluster_id?: string; page?: number; items_per_page?: number }) => {
    const query = new URLSearchParams();
    if (params?.cluster_id) query.set('cluster_id', params.cluster_id);
    if (params?.page) query.set('page', String(params.page));
    if (params?.items_per_page) query.set('items_per_page', String(params.items_per_page));
    const qs = query.toString();
    return apiClient.get<AddonDefinitionListResponse>(`/addon-definitions${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) =>
    apiClient.get<AddonDefinition>(`/addon-definitions/${id}`),

  create: (data: AddonDefinitionCreate) =>
    apiClient.post<AddonDefinition>('/addon-definitions', data),

  update: (id: string, data: AddonDefinitionUpdate) =>
    apiClient.patch<AddonDefinition>(`/addon-definitions/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<void>(`/addon-definitions/${id}`),
};

export const addonInstancesApi = {
  list: (projectId: string) =>
    apiClient.get<AddonInstanceListResponse>(`/addon-instances?project_id=${projectId}`),

  listByOrg: (orgId: string, itemsPerPage = 100) =>
    apiClient.get<AddonInstanceListResponse>(
      `/addon-instances?org_id=${orgId}&items_per_page=${itemsPerPage}`
    ),

  get: (id: string) =>
    apiClient.get<AddonInstance>(`/addon-instances/${id}`),

  create: (data: AddonInstanceCreate) =>
    apiClient.post<AddonInstance>('/addon-instances', data),

  /** Apply a values update OR a chart-version bump — records a revision, dispatches the Helm upgrade. */
  patch: (id: string, body: AddonInstancePatchRequest) =>
    apiClient.patch<AddonInstance>(`/addon-instances/${id}`, body),

  /** Newest-first revision history (values / chart-version changes, with FAILED-revision errors). */
  revisions: (id: string, params?: { page?: number; items_per_page?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.items_per_page) query.set('items_per_page', String(params.items_per_page));
    const qs = query.toString();
    return apiClient.get<AddonInstanceRevisionListResponse>(`/addon-instances/${id}/revisions${qs ? `?${qs}` : ''}`);
  },

  /** Roll back to a prior revision — records a new revision restoring it + dispatches the Helm upgrade. */
  rollback: (id: string, body: AddonInstanceRollbackRequest) =>
    apiClient.post<AddonInstanceRollbackResponse>(`/addon-instances/${id}/rollback`, body),

  delete: (id: string) =>
    apiClient.delete<void>(`/addon-instances/${id}`),
};
