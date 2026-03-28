import { apiClient } from '@/lib/api-client';
import type { ProvisioningJob } from '@/types/api';

export async function getProvisioningJobs(clusterId: string): Promise<ProvisioningJob[]> {
  return apiClient.get<ProvisioningJob[]>(`/clusters/${clusterId}/provisioning-jobs`);
}

export async function getProvisioningJob(jobId: string): Promise<ProvisioningJob> {
  return apiClient.get<ProvisioningJob>(`/provisioning-jobs/${jobId}`);
}

export async function getProvisioningJobLogs(jobId: string): Promise<string | null> {
  const res = await apiClient.get<{ logs: string | null }>(`/provisioning-jobs/${jobId}/logs`);
  return res.logs;
}
