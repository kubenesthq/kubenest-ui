// API Type definitions matching backend OpenAPI schema

// User types
export interface User {
  id: number;
  email: string;
  name: string;
  profile_image_url: string;
  tier_id: number | null;
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
  access_token: string;
  token_type: string;
}

// Cluster types
export type ClusterStatus = 'pending' | 'connected' | 'disconnected' | 'error';

export interface Cluster {
  id: string;
  name: string;
  description: string | null;
  status: ClusterStatus;
  kubernetes_version: string | null;
  node_count: number | null;
  last_heartbeat: string | null;
  registered_at: string;
  created_at: string;
}

export interface ClusterCreateResponse extends Cluster {
  connection_token: string;
  install_command: string;
}

export interface CreateClusterRequest {
  name: string;
  description?: string;
}

// Project types
export interface Project {
  id: string;
  cluster_id: string;
  name: string;
  namespace: string;
  display_name: string | null;
  description: string | null;
  registry_secret: string | null;
  guardrails_config: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateProjectRequest {
  name: string;
  cluster_id: string;
  description?: string;
  display_name?: string;
  registry_secret?: string;
  guardrails_config?: Record<string, unknown>;
}

// Ingress types
export interface IngressConfig {
  enabled: boolean;
  host: string | null;
  path: string;
  tls_secret: string | null;
  annotations: Record<string, string> | null;
}

// Workload types
export type WorkloadPhase = 'pending' | 'building' | 'deploying' | 'running' | 'degraded' | 'failed';
export type WorkloadType = 'deployment' | 'statefulset';

export interface Workload {
  id: string;
  project_id: string;
  name: string;
  type: WorkloadType;
  image: string | null;
  git_source: string | null;
  replicas: number;
  ready_replicas: number;
  port: number | null;
  phase: WorkloadPhase;
  ingress_config: IngressConfig | null;
  build_config: Record<string, unknown> | null;
  exports: Record<string, unknown> | null;
  url: string | null;
  deployed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateWorkloadRequest {
  name: string;
  project_id: string;
  image?: string;
  git_source?: string;
  type?: WorkloadType;
  replicas?: number;
  port?: number;
  build_config?: Record<string, unknown>;
  ingress?: IngressConfig;
}

export interface WorkloadUpdateRequest {
  name?: string;
  image?: string;
  git_source?: string;
  replicas?: number;
  port?: number;
  build_config?: Record<string, unknown>;
  ingress?: IngressConfig;
}

export interface ScaleRequest {
  replicas: number;
}

// Pagination types (matches backend PaginatedListResponse)
export interface PaginatedResponse<T> {
  data: T[];
  total_count: number;
  has_more: boolean;
  page: number | null;
  items_per_page: number | null;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// Specific paginated response types
export type ClusterListResponse = PaginatedResponse<Cluster>;
export type ProjectListResponse = PaginatedResponse<Project>;
export type WorkloadListResponse = PaginatedResponse<Workload>;

// Type aliases for compatibility
export type ClusterCreateRequest = CreateClusterRequest;
export type ProjectCreateRequest = CreateProjectRequest;
export type WorkloadCreateRequest = CreateWorkloadRequest;

// Connection status derived from cluster status
export type ConnectionStatus = 'connected' | 'disconnected' | 'pending';

// Helper to determine connection status from cluster data
export function getConnectionStatus(cluster: Cluster): ConnectionStatus {
  switch (cluster.status) {
    case 'connected':
      return 'connected';
    case 'disconnected':
    case 'error':
      return 'disconnected';
    case 'pending':
    default:
      return 'pending';
  }
}
