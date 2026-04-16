import { apiClient } from '../api-client';
import type { AppCreate, AppRead } from '@/types/api';

export interface AppListResponse {
  data: AppRead[];
  total_count: number;
  has_more: boolean;
  page: number | null;
  items_per_page: number | null;
}

export const appsApi = {
  list: (params?: { project_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.project_id) query.set('project_id', params.project_id);
    const qs = query.toString();
    return apiClient.get<AppListResponse>(`/apps${qs ? `?${qs}` : ''}`);
  },

  get: (namespace: string, name: string) =>
    apiClient.get<AppRead>(`/apps/${namespace}/${name}`),

  create: (data: AppCreate) =>
    apiClient.post<AppRead>('/apps', data),

  delete: (namespace: string, name: string) =>
    apiClient.delete<void>(`/apps/${namespace}/${name}`),
};
