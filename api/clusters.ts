import { apiClient } from '@/lib/api-client';
import type { Cluster, ClusterListResponse, CreateClusterRequest, ClusterCreateResponse } from '@/types/api';

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
