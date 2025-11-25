import { apiClient } from '../api-client';
import type {
  Workload,
  CreateWorkloadRequest,
} from '@/types/api';

export interface WorkloadListResponse {
  items: Workload[];
  total: number;
  page: number;
  page_size: number;
}

export interface ScaleWorkloadRequest {
  replicas: number;
}

export const workloadsApi = {
  // List all workloads for a project
  list: (projectId: string) =>
    apiClient.get<WorkloadListResponse>(`/projects/${projectId}/workloads`),

  // Get single workload
  get: (workloadId: string) =>
    apiClient.get<Workload>(`/workloads/${workloadId}`),

  // Create workload
  create: (projectId: string, data: CreateWorkloadRequest) =>
    apiClient.post<Workload>(`/projects/${projectId}/workloads`, data),

  // Scale workload
  scale: (workloadId: string, data: ScaleWorkloadRequest) =>
    apiClient.patch<Workload>(`/workloads/${workloadId}/scale`, data),

  // Delete workload
  delete: (workloadId: string) =>
    apiClient.delete<void>(`/workloads/${workloadId}`),

  // Redeploy workload
  redeploy: (workloadId: string) =>
    apiClient.post<Workload>(`/workloads/${workloadId}/redeploy`, {}),
};
