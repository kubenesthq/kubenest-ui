import { apiClient } from '@/lib/api-client';
import type {
  Organization,
  OrganizationCreate,
  OrgMember,
  OrgMemberCreate,
} from '@/types/api';

export async function getOrganizations(): Promise<Organization[]> {
  return apiClient.get<Organization[]>('/orgs');
}

export async function getOrganization(id: string): Promise<Organization> {
  return apiClient.get<Organization>(`/orgs/${id}`);
}

export async function createOrganization(data: OrganizationCreate): Promise<Organization> {
  return apiClient.post<Organization>('/orgs', data);
}

export async function deleteOrganization(id: string): Promise<void> {
  return apiClient.delete<void>(`/orgs/${id}`);
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  return apiClient.get<OrgMember[]>(`/orgs/${orgId}/members`);
}

export async function addOrgMember(orgId: string, data: OrgMemberCreate): Promise<OrgMember> {
  return apiClient.post<OrgMember>(`/orgs/${orgId}/members`, data);
}

export async function removeOrgMember(orgId: string, userId: number): Promise<void> {
  return apiClient.delete<void>(`/orgs/${orgId}/members/${userId}`);
}
