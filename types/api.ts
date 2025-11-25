// API Type definitions
// These will be replaced by generated types from kubenest-contracts when available

// User types
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

// Cluster types
export interface Cluster {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  status: 'healthy' | 'degraded' | 'offline';
  operator_version?: string;
  kubernetes_version?: string;
  node_count?: number;
  version?: string;
  last_heartbeat?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateClusterRequest {
  name: string;
  display_name?: string;
  description?: string;
}

// Project types
export interface Project {
  id: string;
  cluster_id: string;
  name: string;
  display_name: string;
  namespace?: string;
  phase: 'Pending' | 'Ready' | 'Failed';
  status?: 'pending' | 'creating' | 'active' | 'failed';
  description?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateProjectRequest {
  name: string;
  cluster_id: string;
  description?: string;
}

// Workload types
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

export interface CreateWorkloadRequest {
  name: string;
  image: string;
  replicas: number;
  port?: number;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// API Response types
export interface ClusterListResponse {
  items: Cluster[];
  total: number;
  page: number;
  page_size: number;
}

export interface ClusterResponse {
  data: Cluster;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProjectResponse {
  data: Project;
}

// Type aliases for compatibility
export type ClusterCreateRequest = CreateClusterRequest;
export type ProjectCreateRequest = CreateProjectRequest;
export type WorkloadCreateRequest = CreateWorkloadRequest;

// Utility types
export type ClusterStatus = 'healthy' | 'degraded' | 'offline';
export type ConnectionStatus = 'connected' | 'disconnected' | 'pending';

// Helper to determine connection status from cluster data
export function getConnectionStatus(cluster: Cluster): ConnectionStatus {
  if (!cluster.last_heartbeat) return 'pending';

  const lastHeartbeat = new Date(cluster.last_heartbeat);
  const now = new Date();
  const minutesSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / 1000 / 60;

  if (minutesSinceHeartbeat > 5) return 'disconnected';
  return 'connected';
}
