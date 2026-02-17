import { apiClient } from '../api-client';
import type {
  Workload,
  CreateWorkloadRequest,
  WorkloadListResponse,
  ScaleRequest,
} from '@/types/api';

export const workloadsApi = {
  // List all workloads for a project
  list: (projectId: string) =>
    apiClient.get<WorkloadListResponse>(`/workloads?project_id=${projectId}`),

  // Get single workload
  get: (workloadId: string) =>
    apiClient.get<Workload>(`/workloads/${workloadId}`),

  // Create workload (POST /workloads with project_id in body)
  create: (data: CreateWorkloadRequest) =>
    apiClient.post<Workload>('/workloads', data),

  // Scale workload (POST, not PATCH)
  scale: (workloadId: string, data: ScaleRequest) =>
    apiClient.post<Workload>(`/workloads/${workloadId}/scale`, data),

  // Delete workload
  delete: (workloadId: string) =>
    apiClient.delete<void>(`/workloads/${workloadId}`),

  // Redeploy workload
  redeploy: (workloadId: string) =>
    apiClient.post<{ message: string; workload_id: string; phase: string }>(
      `/workloads/${workloadId}/redeploy`,
      {}
    ),
};
