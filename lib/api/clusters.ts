import { apiClient } from '../api-client';
import type {
  Cluster,
  ClusterListResponse,
  ClusterCreateRequest,
  ClusterCreateResponse,
  ProjectListResponse,
} from '@/types/api';

export const clustersApi = {
  // List all clusters
  list: () => apiClient.get<ClusterListResponse>('/clusters'),

  // Get single cluster
  get: (id: string) => apiClient.get<Cluster>(`/clusters/${id}`),

  // Create cluster
  create: (data: ClusterCreateRequest) =>
    apiClient.post<ClusterCreateResponse>('/clusters', data),

  // Delete cluster
  delete: (id: string) => apiClient.delete<void>(`/clusters/${id}`),

  // Get projects for a cluster
  getProjects: (clusterId: string) =>
    apiClient.get<ProjectListResponse>(`/projects?cluster_id=${clusterId}`),

  // Get install command from server
  getInstallCommand: (clusterId: string) =>
    apiClient.get<{ command: string; token: string; cluster_id: string; hub_url: string }>(
      `/clusters/${clusterId}/install-command`
    ),
};
