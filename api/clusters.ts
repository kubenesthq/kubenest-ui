import { apiClient } from '@/lib/api-client';
import type { Cluster, ClusterListResponse, CreateClusterRequest, ClusterCreateResponse } from '@/types/api';

export async function getClusters(): Promise<ClusterListResponse> {
  return apiClient.get<ClusterListResponse>('/clusters');
}

export async function getCluster(id: string): Promise<Cluster> {
  return apiClient.get<Cluster>(`/clusters/${id}`);
}

export async function createCluster(data: CreateClusterRequest): Promise<ClusterCreateResponse> {
  return apiClient.post<ClusterCreateResponse>('/clusters', data);
}

export async function deleteCluster(id: string): Promise<void> {
  return apiClient.delete<void>(`/clusters/${id}`);
}
