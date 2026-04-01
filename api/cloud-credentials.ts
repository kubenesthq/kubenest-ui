import { apiClient } from '@/lib/api-client';
import type {
  CloudCredential,
  CloudCredentialCreate,
  CloudCredentialUpdate,
  CloudCredentialListResponse,
} from '@/types/api';

export async function getCloudCredentials(orgId: string): Promise<CloudCredentialListResponse> {
  return apiClient.get<CloudCredentialListResponse>(`/orgs/${orgId}/credentials`);
}

export async function getCloudCredential(id: string): Promise<CloudCredential> {
  return apiClient.get<CloudCredential>(`/credentials/${id}`);
}

export async function createCloudCredential(orgId: string, data: CloudCredentialCreate): Promise<CloudCredential> {
  return apiClient.post<CloudCredential>(`/orgs/${orgId}/credentials`, data);
}

export async function updateCloudCredential(id: string, data: CloudCredentialUpdate): Promise<CloudCredential> {
  return apiClient.patch<CloudCredential>(`/credentials/${id}`, data);
}

export async function deleteCloudCredential(id: string): Promise<void> {
  return apiClient.delete<void>(`/credentials/${id}`);
}
