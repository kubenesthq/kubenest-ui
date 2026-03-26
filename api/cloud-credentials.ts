import { apiClient } from '@/lib/api-client';
import type {
  CloudCredential,
  CloudCredentialCreate,
  CloudCredentialUpdate,
  CloudCredentialListResponse,
} from '@/types/api';

export async function getCloudCredentials(): Promise<CloudCredentialListResponse> {
  return apiClient.get<CloudCredentialListResponse>('/cloud-credentials');
}

export async function getCloudCredential(id: string): Promise<CloudCredential> {
  return apiClient.get<CloudCredential>(`/cloud-credentials/${id}`);
}

export async function createCloudCredential(data: CloudCredentialCreate): Promise<CloudCredential> {
  return apiClient.post<CloudCredential>('/cloud-credentials', data);
}

export async function updateCloudCredential(id: string, data: CloudCredentialUpdate): Promise<CloudCredential> {
  return apiClient.patch<CloudCredential>(`/cloud-credentials/${id}`, data);
}

export async function deleteCloudCredential(id: string): Promise<void> {
  return apiClient.delete<void>(`/cloud-credentials/${id}`);
}
