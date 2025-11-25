import { apiClient } from '@/lib/api-client';
import type { Cluster, CreateClusterRequest } from '@/types/api';

export async function getClusters(): Promise<{ data: Cluster[] }> {
  return apiClient.get<{ data: Cluster[] }>('/clusters');
}

export async function getCluster(id: string): Promise<{ data: Cluster }> {
  return apiClient.get<{ data: Cluster }>(`/clusters/${id}`);
}

export async function createCluster(data: CreateClusterRequest): Promise<{ data: Cluster }> {
  return apiClient.post<{ data: Cluster }>('/clusters', data);
}

export async function deleteCluster(id: string): Promise<void> {
  return apiClient.delete<void>(`/clusters/${id}`);
}
