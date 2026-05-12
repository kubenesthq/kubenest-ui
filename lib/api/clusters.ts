import { apiClient } from '../api-client';
import type {
  Cluster,
  ClusterListResponse,
  ClusterCreateRequest,
  ClusterCreateResponse,
  ClusterScaleRequest,
  ClusterScaleResponse,
  ProjectListResponse,
} from '@/types/api';

export const clustersApi = {
  // List all clusters in an org
  list: (orgId: string) => apiClient.get<ClusterListResponse>(`/orgs/${orgId}/clusters`),

  // Get single cluster (flat, access checked server-side)
  get: (id: string) => apiClient.get<Cluster>(`/clusters/${id}`),

  // Create cluster under an org
  create: (orgId: string, data: ClusterCreateRequest) =>
    apiClient.post<ClusterCreateResponse>(`/orgs/${orgId}/clusters`, data),

  // Delete cluster (flat, access checked server-side)
  delete: (id: string) => apiClient.delete<void>(`/clusters/${id}`),

  // Scale a Terraform-provisioned cluster -> ProvisioningJob(SCALE)
  scale: (id: string, body: ClusterScaleRequest) =>
    apiClient.post<ClusterScaleResponse>(`/clusters/${id}/scale`, body),

  // Get projects for a cluster
  getProjects: (clusterId: string) =>
    apiClient.get<ProjectListResponse>(`/projects?cluster_id=${clusterId}`),

  // Get install command from server
  getInstallCommand: (clusterId: string) =>
    apiClient.get<{ command: string; token: string; cluster_id: string; hub_url: string }>(
      `/clusters/${clusterId}/install-command`
    ),
};
