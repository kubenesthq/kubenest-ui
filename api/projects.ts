import { apiClient } from '@/lib/api-client';
import type { Project, ProjectListResponse, CreateProjectRequest } from '@/types/api';

export interface ProjectWithDetails extends Project {
  cluster_name?: string;
  workloads_count?: number;
}

export async function getProjects(clusterId: string): Promise<ProjectListResponse> {
  return apiClient.get<ProjectListResponse>(`/projects?cluster_id=${clusterId}`);
}

export async function getAllProjects(): Promise<ProjectListResponse> {
  return apiClient.get<ProjectListResponse>('/projects');
}

export async function getProject(id: string): Promise<Project> {
  return apiClient.get<Project>(`/projects/${id}`);
}

export async function createProject(data: CreateProjectRequest): Promise<Project> {
  return apiClient.post<Project>('/projects', data);
}

export async function deleteProject(id: string): Promise<void> {
  return apiClient.delete<void>(`/projects/${id}`);
}
