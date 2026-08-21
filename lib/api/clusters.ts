import { apiClient } from '../api-client';
import type {
  Cluster,
  ClusterHealth,
  ClusterListResponse,
  ClusterCreateRequest,
  ClusterCreateResponse,
  ClusterScaleRequest,
  ClusterScaleResponse,
  InstallInstructions,
  ProjectListResponse,
} from '@/types/api';

export const clustersApi = {
  // List all clusters in an org
  list: (orgId: string) => apiClient.get<ClusterListResponse>(`/orgs/${orgId}/clusters`),

  // Get single cluster (flat, access checked server-side)
  get: (id: string) => apiClient.get<Cluster>(`/clusters/${id}`),

  // Evaluated always-on fleet facts, including the exact persisted restore
  // drill result under the backup check's detail.last_restore_drill.
  getHealth: (id: string) => apiClient.get<ClusterHealth>(`/clusters/${id}/health`),

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

  // Secret-free install instructions (kn-rnyl phase A). The old
  // /install-command endpoint is a 410: it embedded credentials in a
  // browser-renderable response, which is exactly what must never happen.
  getInstallInstructions: (clusterId: string) =>
    apiClient.get<InstallInstructions>(`/clusters/${clusterId}/install-instructions`),
};
