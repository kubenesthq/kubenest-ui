import { apiClient } from '../api-client';
import type {
  AddonDefinition,
  AddonDefinitionCreate,
  AddonDefinitionUpdate,
  AddonDefinitionListResponse,
  AddonInstance,
  AddonInstanceCreate,
  AddonInstanceListResponse,
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

  get: (id: string) =>
    apiClient.get<AddonInstance>(`/addon-instances/${id}`),

  create: (data: AddonInstanceCreate) =>
    apiClient.post<AddonInstance>('/addon-instances', data),

  delete: (id: string) =>
    apiClient.delete<void>(`/addon-instances/${id}`),
};
