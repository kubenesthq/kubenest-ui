import { apiClient } from '@/lib/api-client';
import type { Workload, CreateWorkloadRequest } from '@/types/api';

export async function getWorkloads(projectId: string): Promise<{ data: Workload[] }> {
  return apiClient.get<{ data: Workload[] }>(`/projects/${projectId}/workloads`);
}

export async function getWorkload(id: string): Promise<{ data: Workload }> {
  return apiClient.get<{ data: Workload }>(`/workloads/${id}`);
}

export async function createWorkload(
  projectId: string,
  data: CreateWorkloadRequest
): Promise<{ data: Workload }> {
  return apiClient.post<{ data: Workload }>(`/projects/${projectId}/workloads`, data);
}

export async function scaleWorkload(
  id: string,
  replicas: number
): Promise<{ data: Workload }> {
  return apiClient.patch<{ data: Workload }>(`/workloads/${id}/scale`, { replicas });
}

export async function deleteWorkload(id: string): Promise<void> {
  return apiClient.delete<void>(`/workloads/${id}`);
}
