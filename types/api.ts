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

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
  created_at: string;
  updated_at: string | null;
}

export interface OrgMember {
  org_id: string;
  user_id: number;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
}

export interface OrgMemberCreate {
  user_id: number;
  role?: 'admin' | 'member' | 'viewer';
}

export interface OrganizationCreate {
  name: string;
  slug: string;
}

// Cluster types
export type ClusterStatus = 'pending' | 'provisioning' | 'connected' | 'disconnected' | 'error';

export interface MonitoringConfig {
  enabled: boolean;
  provider?: string | null;
  remote_write_url?: string | null;
  credentials_secret?: string | null;
}

export interface ComponentsConfig {
  storage: boolean;
  ha: boolean;
  build: boolean;
  monitoring: MonitoringConfig;
}

export interface Cluster {
  id: string;
  name: string;
  description: string | null;
  status: ClusterStatus;
  org_id: string | null;
  kubernetes_version: string | null;
  node_count: number | null;
  last_heartbeat: string | null;
  registered_at: string;
  created_at: string;
  base_domain: string | null;
  enterprise_domain: string | null;
  components?: ComponentsConfig | null;
}

export interface ClusterCreateResponse extends Cluster {
  connection_token: string;
  install_command: string;
}

export interface CreateClusterRequest {
  name: string;
  description?: string;
  // Provisioning fields (omit for manual/BYOC cluster registration)
  provider?: CloudProvider;
  credential_id?: string;
  region?: string;
  instance_type?: string;
  agent_count?: number;
  disk_size_gb?: number;
  // Component selection
  components?: ComponentsConfig;
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

export interface ChartSpec {
  repo: string;
  name: string;
  version: string;
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

// Addon types
export type AddonType = 'postgres' | 'redis' | 'kafka' | 'mongodb' | 'mysql' | 'rabbitmq' | 'custom';
export type AddonPhase = 'Pending' | 'Deploying' | 'Running' | 'Degraded' | 'Failed';

export interface ExportSchemaEntry {
  description: string;
  example?: string;
  default?: string;
  secret?: boolean;
}

export interface AddonDefinition {
  id: string;
  cluster_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  tags: string[] | null;
  type: AddonType;
  chart_config: ChartSpec | null;
  default_values: Record<string, unknown> | null;
  exposed_values: Record<string, unknown> | null;
  export_schema: Record<string, ExportSchemaEntry> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface AddonDefinitionCreate {
  name: string;
  slug: string;
  type: AddonType;
  cluster_id?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  chart_config?: ChartSpec;
  default_values?: Record<string, unknown>;
}

export interface AddonDefinitionUpdate {
  name?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  chart_config?: ChartSpec;
  default_values?: Record<string, unknown>;
  is_active?: boolean;
}

export interface AddonInstance {
  id: string;
  definition_id: string | null;
  project_id: string;
  name: string;
  type: AddonType;
  chart_config: Record<string, unknown> | null;
  phase: AddonPhase;
  exports: Record<string, string> | null;
  deployed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AddonInstanceCreate {
  project_id: string;
  name: string;
  definition_id?: string;
  type?: AddonType;
  chart?: ChartSpec;
  values?: Record<string, unknown>;
}

// Registry secret types
export type RegistrySecretScope = 'org' | 'cluster' | 'project';

export interface RegistrySecret {
  id: string;
  name: string;
  server_url: string;
  username: string;
  scope: RegistrySecretScope;
  org_id: string | null;
  cluster_id: string | null;
  project_id: string | null;
  created_at: string;
}

export interface CreateRegistrySecretRequest {
  name: string;
  server_url: string;
  username: string;
  password: string;
}

// Specific paginated response types
export type ClusterListResponse = PaginatedResponse<Cluster>;
export type ProjectListResponse = PaginatedResponse<Project>;
export type AddonDefinitionListResponse = PaginatedResponse<AddonDefinition>;
export type AddonInstanceListResponse = PaginatedResponse<AddonInstance>;

// Cloud credential types
export type CloudProvider = 'AWS';

export interface CloudCredential {
  id: string;
  name: string;
  provider: CloudProvider;
  region: string;
  access_key_id: string;
  org_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CloudCredentialCreate {
  name: string;
  provider: CloudProvider;
  access_key_id: string;
  secret_access_key: string;
  region: string;
}

export interface CloudCredentialUpdate {
  name?: string;
  region?: string;
  access_key_id?: string;
  secret_access_key?: string;
}

export type CloudCredentialListResponse = PaginatedResponse<CloudCredential>;

// Provisioning types
export type ProvisioningAction = 'CREATE' | 'SCALE' | 'DESTROY';
export type ProvisioningStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface ProvisioningJob {
  id: string;
  cluster_id: string;
  credential_id: string | null;
  action: ProvisioningAction;
  status: ProvisioningStatus;
  progress_pct: number;
  error_message: string | null;
  terraform_state_key: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

// App (StackDeploy) types
export type AppPhase = 'Pending' | 'Deploying' | 'Running' | 'Degraded' | 'Failed';

export interface AppEnvVar {
  name: string;
  value?: string;
  export_ref?: {
    component: string;
    export_key: string;
  };
}

export interface WorkloadSpec {
  image: string;
  replicas?: number;
  port?: number | null;
  env?: AppEnvVar[];
  ingress?: {
    enabled: boolean;
    host: string;
    path: string;
  };
}

export interface AddonSpec {
  type: AddonType;
  chart: ChartSpec;
  values?: Record<string, unknown>;
  timeout?: string;
}

export type AppComponentType = 'workload' | 'addon';

export interface AppComponent {
  name: string;
  type: AppComponentType;
  depends_on?: string[];
  workload_spec?: WorkloadSpec;
  addon_spec?: AddonSpec;
}

export interface AppCreate {
  name: string;
  project_id: string;
  components: AppComponent[];
  timeout?: string;
}

export interface AppPatch {
  components?: AppComponent[];
  timeout?: string;
}

export interface AppReadComponent {
  name: string;
  type: AppComponentType;
}

export interface AppRead {
  uid: string;
  name: string;
  namespace: string;
  phase: AppPhase;
  message?: string | null;
  component_count: number;
  components: AppReadComponent[];
  project_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface AppList {
  data: AppRead[];
  total_count: number;
}

export interface AppRedeployResponse {
  message: string;
  name: string;
  namespace: string;
  components_synced: number;
}

export interface ComponentStatus {
  name: string;
  type: string;
  health?: string | null;
  sync?: string | null;
  phase: string;
}

export interface AppStatusResponse {
  name: string;
  namespace: string;
  phase: string;
  components: ComponentStatus[];
}

export interface ComponentSecretList {
  component: string;
  keys: string[];
}

export interface ComponentSecretUpsert {
  secrets: Record<string, string>;
}

// Deployment history (formerly under workloads, now under apps).
export type DeploymentTargetType = 'workload' | 'stack_deploy';
export type DeploymentStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type DeploymentTrigger = 'user' | 'automated';

export interface DeploymentRecord {
  id: string;
  target_type: DeploymentTargetType;
  target_id: string;
  description: string;
  sha: string | null;
  status: DeploymentStatus;
  triggered_by: DeploymentTrigger;
  user_id: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  prior_state: Record<string, unknown> | null;
}

export interface DeploymentListResponse {
  data: DeploymentRecord[];
  total_count: number;
  page: number;
  items_per_page: number;
}

// Type aliases for compatibility
export type ClusterCreateRequest = CreateClusterRequest;
export type ProjectCreateRequest = CreateProjectRequest;

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
