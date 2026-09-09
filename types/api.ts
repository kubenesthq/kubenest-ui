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

export type FleetHealthStatus = 'ok' | 'unknown' | 'warning' | 'critical';

export interface RestoreDrillResult {
  status: 'never_run' | 'passed' | 'failed';
  completed_at?: string;
  backup?: string;
  duration_seconds?: number;
  verification?: {
    mode: 'full';
    objects: { restored: number; matched: number };
    pvc_data: { restored: number; matched: number };
  };
  failure?: {
    stage: string;
    reason_code: string;
    detail: string;
  };
}

export interface ClusterHealthCheck {
  check: string;
  status: FleetHealthStatus;
  reason_code: string;
  message: string;
  detail: Record<string, unknown>;
}

export interface ClusterHealth {
  cluster_id: string;
  cluster_name: string;
  status: FleetHealthStatus;
  checks: ClusterHealthCheck[];
  reported_at?: string | null;
  received_at?: string | null;
  report_interval_seconds?: number | null;
  bundle_version?: string | null;
  thresholds_provisional?: boolean | null;
}

// kn-rnyl phase A: create responses are credential-free. The console shows the
// CLI pointer; credentials are minted only by POST agent-credentials (CLI-side).
export interface ClusterCreateResponse extends Cluster {
  cli_command: string | null;
}

// Secret-free install surface (contract v1.12.0) — everything the UI may render.
export interface InstallInstructions {
  cluster_id: string;
  cli_command: string | null;
  hub_url?: string | null;
  namespace: string;
  chart_ref?: string | null;
  docs_url: string;
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
  // Retained for the provisioning wizard. Manual registration intentionally
  // omits it: the current backend registration contract does not accept it.
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

/** One entry in an AddonDefinition's ordered chart-version history (kn-b12). */
export interface AddonVersionHistoryEntry {
  version: string;
  released_at?: string | null;
  deprecated?: boolean;
  changelog?: string | null;
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
  /** Ordered chart-version history; the catalog "changelog drawer" renders this. */
  version_history: AddonVersionHistoryEntry[] | null;
  /** Per-version changelog keyed by chart version, e.g. {"15.5.23": "release notes…"}. */
  changelog: Record<string, string> | null;
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
  version_history?: AddonVersionHistoryEntry[];
  changelog?: Record<string, string>;
}

export interface AddonDefinitionUpdate {
  name?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  chart_config?: ChartSpec;
  default_values?: Record<string, unknown>;
  version_history?: AddonVersionHistoryEntry[];
  changelog?: Record<string, string>;
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

// Addon-instance lifecycle: PATCH / revisions / rollback (kn-b12)
export type AddonInstanceRevisionStatus = 'Pending' | 'Applied' | 'Failed';

export interface AddonInstanceRevision {
  id: string;
  instance_id: string;
  revision_number: number;
  chart_config: Record<string, unknown> | null;
  values: Record<string, unknown> | null;
  status: AddonInstanceRevisionStatus;
  note: string | null;
  created_by: number | null;
  error_message: string | null;
  created_at: string;
}

export interface AddonInstanceRevisionListResponse {
  data: AddonInstanceRevision[];
  total_count: number;
  page: number;
  items_per_page: number;
}

/** Exactly one of `values` / `chart_version` must be set. */
export interface AddonInstancePatchRequest {
  values?: Record<string, unknown>;
  chart_version?: string;
  note?: string;
}

/** Exactly one of `revision_id` / `revision_number` must be set. */
export interface AddonInstanceRollbackRequest {
  revision_id?: string;
  revision_number?: number;
  note?: string;
}

export interface AddonInstanceRollbackResponse {
  message: string;
  rolled_back_to: AddonInstanceRevision;
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

// Metrics (C6 time-series) — GET /apps/{ns}/{name}/metrics, GET /clusters/{id}/metrics
export type MetricsRange = '15m' | '1h' | '6h' | '24h' | '7d';
export type MetricsCategory = 'app' | 'component' | 'cluster_capacity';

export interface MetricsSeries {
  name: string;
  unit: string;
  category?: MetricsCategory | null;
  component?: string | null;
  /** [timestampSeconds, value] pairs, oldest first. */
  points: [number, number][];
}

export interface MetricsSeriesResponse {
  series: MetricsSeries[];
}

// Specific paginated response types
export type ClusterListResponse = PaginatedResponse<Cluster>;
export type ProjectListResponse = PaginatedResponse<Project>;
export type AddonDefinitionListResponse = PaginatedResponse<AddonDefinition>;
export type AddonInstanceListResponse = PaginatedResponse<AddonInstance>;

// Cloud credential types — provider ids match the backend CloudProvider enum (lowercase).
export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'do' | 'metal' | 'ssh';

export interface CloudProviderInfo {
  id: CloudProvider;
  label: string;
  /** false = "coming soon": credential shapes are accepted but provisioning isn't wired yet. */
  wired: boolean;
}

// The platform's provider catalogue + wired/coming-soon status (mirrors the
// backend PROVIDER_CAPABILITIES table). Only `wired` providers can provision.
export const CLOUD_PROVIDERS: CloudProviderInfo[] = [
  { id: 'aws', label: 'Amazon Web Services', wired: true },
  { id: 'gcp', label: 'Google Cloud', wired: false },
  { id: 'azure', label: 'Microsoft Azure', wired: false },
  { id: 'do', label: 'DigitalOcean', wired: false },
  { id: 'metal', label: 'Bare metal', wired: false },
  { id: 'ssh', label: 'Existing hosts (SSH)', wired: false },
];

export function cloudProviderInfo(id: string | null | undefined): CloudProviderInfo {
  const key = (id ?? '').toLowerCase();
  return (
    CLOUD_PROVIDERS.find((p) => p.id === key) ?? {
      id: (key || 'aws') as CloudProvider,
      label: (id ?? 'Unknown').toUpperCase(),
      wired: false,
    }
  );
}

export interface CloudCredential {
  id: string;
  name: string;
  provider: CloudProvider;
  // AWS-shape providers (aws/gcp/azure/do/metal):
  region: string | null;
  access_key_id: string | null;
  // SSH-shape provider:
  user?: string | null;
  hosts?: string[] | null;
  org_id: string | null;
  created_at: string;
  updated_at: string | null;
  /** Provisioning capability flags for this credential's provider (kn-b6). */
  wired?: boolean;
  coming_soon?: boolean;
}

// Provider-specific shape — see the backend CloudCredentialCreate validator.
// AWS-shape needs region + access_key_id + secret_access_key; SSH needs user + hosts[] + private_key.
export interface CloudCredentialCreate {
  name: string;
  provider: CloudProvider;
  region?: string;
  access_key_id?: string;
  secret_access_key?: string;
  user?: string;
  hosts?: string[];
  private_key?: string;
}

export interface CloudCredentialUpdate {
  name?: string;
  region?: string;
  access_key_id?: string;
  secret_access_key?: string;
  user?: string;
  hosts?: string[];
  private_key?: string;
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

// POST /clusters/{id}/scale — change node count/size on a Terraform-provisioned cluster.
export interface ClusterScaleRequest {
  desired_node_count: number;
  desired_node_size?: string | null;
}

export interface ClusterScaleResponse {
  cluster_id: string;
  action: 'SCALE';
  provisioning_job: ProvisioningJob;
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
  image?: string;
  chart?: ChartSpec;
  replicas?: number;
  port?: number | null;
  env?: AppEnvVar[];
  resources?: Record<string, unknown>;
  values?: Record<string, unknown>;
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

/** One env-var injection in an addon-attach request (kn-h1v). */
export interface AddonEnvMapping {
  workload_component: string;
  env_var_name: string;
  export_key: string;
}

/** Body for POST /apps/{ns}/{name}/attach-addon (kn-h1v). */
export interface AppAddonAttachRequest {
  addon_instance_id: string;
  env_mappings: AddonEnvMapping[];
}

export interface AppPatch {
  // Patch-by-name on existing components (full spec replacement for that name).
  components?: AppComponent[];
  // New components to append (kn-coa). Names must not collide with components
  // that survive any remove_component_names in the same request.
  add_components?: AppComponent[];
  // Existing components to delete (kn-coa). The app must retain at least one
  // component after removal, and no remaining component may export_ref a
  // removed component.
  remove_component_names?: string[];
  timeout?: string;
}

export interface DriftDetail {
  resource?: string | null;
  field?: string | null;
  desired?: unknown;
  observed?: unknown;
  blocked?: boolean | null;
  reason?: string | null;
  [key: string]: unknown;
}

export interface SyncDriftStatus {
  desired?: string | null;
  observed?: string | null;
  driftDetected?: boolean;
  driftDetails?: DriftDetail[];
  lastSyncRevision?: string | null;
  lastSyncTime?: string | null;
  syncSource?: string | null;
  driftClass?: string | null;
  [key: string]: unknown;
}

export interface AppReadComponent {
  name: string;
  type: AppComponentType;
  // Backend now returns these (kn-coa / df6916f); kept optional so older
  // payloads degrade gracefully — callers that need them must null-check.
  // Typed as Record<string, unknown> rather than WorkloadSpec/AddonSpec
  // because the live CR dict uses camelCased keys that aren't fully modelled
  // here; consumers normalize as needed.
  workload_spec?: Record<string, unknown> | null;
  addon_spec?: Record<string, unknown> | null;
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
  template_id?: string | null;
  created_at: string;
  updated_at: string | null;
  sync?: SyncDriftStatus | null;
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
  sync?: SyncDriftStatus | null;
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
