// API Type definitions
// These will be generated from kubenest-contracts later
// For now, we define basic types for the MVP

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Cluster {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  version?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  cluster_id: string;
  name: string;
  namespace: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Workload {
  id: string;
  project_id: string;
  name: string;
  image: string;
  replicas: number;
  port?: number;
  phase: 'Pending' | 'Deploying' | 'Running' | 'Failed' | 'Degraded';
  created_at: string;
  updated_at: string;
}

export interface CreateClusterRequest {
  name: string;
}

export interface CreateProjectRequest {
  name: string;
  cluster_id: string;
}

export interface CreateWorkloadRequest {
  name: string;
  image: string;
  replicas: number;
  port?: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}
