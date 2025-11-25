import { apiClient } from '../api-client';
import type {
  Cluster,
  ClusterListResponse,
  ClusterCreateRequest,
  Project,
  ProjectListResponse,
} from '@/types/api';

export const clustersApi = {
  // List all clusters
  list: () => apiClient.get<ClusterListResponse>('/clusters'),

  // Get single cluster
  get: (id: string) => apiClient.get<Cluster>(`/clusters/${id}`),

  // Create cluster
  create: (data: ClusterCreateRequest) =>
    apiClient.post<Cluster>('/clusters', data),

  // Delete cluster
  delete: (id: string) => apiClient.delete<void>(`/clusters/${id}`),

  // Get projects for a cluster
  getProjects: (clusterId: string) =>
    apiClient.get<ProjectListResponse>(`/projects?cluster_id=${clusterId}`),

  // Get install command for a cluster
  getInstallCommand: (cluster: Cluster) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `helm repo add kubenest https://charts.kubenest.io && \\
helm install kubenest-operator kubenest/kubenest-operator \\
  --namespace kubenest-system \\
  --create-namespace \\
  --set cluster.id=${cluster.id} \\
  --set cluster.name=${cluster.name} \\
  --set api.url=${baseUrl}`;
  },
};
