import { apiClient } from '../api-client';
import type {
  Workload,
  CreateWorkloadRequest,
  WorkloadUpdateRequest,
  WorkloadListResponse,
  ScaleRequest,
} from '@/types/api';

export type DeploymentTargetType = 'workload' | 'stack_deploy';
export type DeploymentStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type DeploymentTrigger = 'user' | 'automated';

export interface DeploymentRecord {
  id: string;
  target_type: DeploymentTargetType;
  target_id: string;
  description: string;
  sha: string | null;
  status: DeploymentStatus;
  triggered_by: DeploymentTrigger;
  user_id: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DeploymentListResponse {
  data: DeploymentRecord[];
  total_count: number;
  page: number;
  items_per_page: number;
}

export interface AvailableExport {
  addon_instance_id: string;
  addon_name: string;
  addon_type: string;
  export_key: string;
  display: string;
  env_var_suggestion: string;
}

export const workloadsApi = {
  list: (projectId: string) =>
    apiClient.get<WorkloadListResponse>(`/workloads?project_id=${projectId}`),

  listByOrg: (orgId: string, itemsPerPage = 100) =>
    apiClient.get<WorkloadListResponse>(
      `/workloads?org_id=${orgId}&items_per_page=${itemsPerPage}`
    ),

  get: (workloadId: string) =>
    apiClient.get<Workload>(`/workloads/${workloadId}`),

  create: (data: CreateWorkloadRequest) =>
    apiClient.post<Workload>('/workloads', data),

  update: (workloadId: string, data: WorkloadUpdateRequest) =>
    apiClient.patch<Workload>(`/workloads/${workloadId}`, data),

  scale: (workloadId: string, data: ScaleRequest) =>
    apiClient.post<Workload>(`/workloads/${workloadId}/scale`, data),

  delete: (workloadId: string) =>
    apiClient.delete<void>(`/workloads/${workloadId}`),

  redeploy: (workloadId: string) =>
    apiClient.post<{ message: string; workload_id: string; phase: string }>(
      `/workloads/${workloadId}/redeploy`,
      {}
    ),

  listDeployments: (workloadId: string, page = 1, itemsPerPage = 20) =>
    apiClient.get<DeploymentListResponse>(
      `/workloads/${workloadId}/deployments?page=${page}&items_per_page=${itemsPerPage}`
    ),
};

export const projectExportsApi = {
  getAvailableExports: (projectId: string) =>
    apiClient.get<AvailableExport[]>(`/projects/${projectId}/available-exports`),
};
