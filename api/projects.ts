import { apiClient } from '@/lib/api-client';
import type { Project } from '@/types/api';

export interface CreateProjectRequest {
  name: string;
  cluster_id: string;
  description?: string;
}

export interface ProjectWithDetails extends Project {
  cluster_name?: string;
  workloads_count?: number;
}

export async function getProjects(clusterId: string): Promise<{ data: Project[] }> {
  return apiClient.get<{ data: Project[] }>(`/clusters/${clusterId}/projects`);
}

export async function getAllProjects(): Promise<{ data: Project[] }> {
  return apiClient.get<{ data: Project[] }>('/projects');
}

export async function getProject(id: string): Promise<{ data: Project }> {
  return apiClient.get<{ data: Project }>(`/projects/${id}`);
}

export async function createProject(data: CreateProjectRequest): Promise<{ data: Project }> {
  return apiClient.post<{ data: Project }>('/projects', data);
}

export async function deleteProject(id: string): Promise<void> {
  return apiClient.delete<void>(`/projects/${id}`);
}
