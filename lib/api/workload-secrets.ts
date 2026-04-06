import { apiClient } from '../api-client';

export interface SecretRead {
  key: string;
  created_at: string;
  updated_at: string | null;
}

export interface SecretListRead {
  workload_id: string;
  secrets: SecretRead[];
  total_count: number;
}

export const workloadSecretsApi = {
  list: (workloadId: string) =>
    apiClient.get<SecretListRead>(`/workloads/${workloadId}/secrets`),

  set: (workloadId: string, secrets: Record<string, string>) =>
    apiClient.post<SecretListRead>(`/workloads/${workloadId}/secrets`, { secrets }),

  update: (workloadId: string, secrets: Record<string, string>) =>
    apiClient.patch<SecretListRead>(`/workloads/${workloadId}/secrets`, { secrets }),

  remove: (workloadId: string, key: string) =>
    apiClient.delete<SecretListRead>(`/workloads/${workloadId}/secrets/${encodeURIComponent(key)}`),
};
