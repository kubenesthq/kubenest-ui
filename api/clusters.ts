import { apiClient } from '@/lib/api-client';
import type { Cluster, ClusterListResponse, CreateClusterRequest, ClusterCreateResponse, ComponentsConfig } from '@/types/api';

export async function getClusters(orgId: string): Promise<ClusterListResponse> {
  return apiClient.get<ClusterListResponse>(`/orgs/${orgId}/clusters`);
}

export async function getCluster(id: string): Promise<Cluster> {
  return apiClient.get<Cluster>(`/clusters/${id}`);
}

export async function createCluster(orgId: string, data: CreateClusterRequest): Promise<ClusterCreateResponse> {
  return apiClient.post<ClusterCreateResponse>(`/orgs/${orgId}/clusters`, data);
}

export async function deleteCluster(id: string): Promise<void> {
  return apiClient.delete<void>(`/clusters/${id}`);
}

export async function getClusterConfig(id: string): Promise<ComponentsConfig> {
  return apiClient.get<ComponentsConfig>(`/clusters/${id}/config`);
}

export async function updateClusterConfig(id: string, config: ComponentsConfig): Promise<ComponentsConfig> {
  return apiClient.put<ComponentsConfig>(`/clusters/${id}/config`, config);
}
