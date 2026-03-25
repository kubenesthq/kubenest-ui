/**
 * Demo localStorage store for workloads, addon attachments, and stack templates.
 * Used for demo/presentation purposes — no backend calls.
 */

export interface DemoWorkload {
  id: string;
  project_id: string;
  name: string;
  source_type: 'image' | 'git';
  image: string | null;
  git_repo: string | null;
  git_branch: string | null;
  dockerfile_path: string | null;
  replicas: number;
  port: number | null;
  env: Record<string, string>;
  phase: 'pending' | 'building' | 'deploying' | 'running';
  addons: DemoAddonAttachment[];
  created_at: string;
}

export interface DemoAddonAttachment {
  id: string;
  addon_type: string;
  addon_name: string;
  config: Record<string, string>;
  env_bindings: Record<string, string>; // e.g. { DATABASE_URL: "postgres://..." }
  created_at: string;
}

export interface DemoStackTemplate {
  id: string;
  name: string;
  description: string;
  source_workload_id: string;
  workload_config: Omit<DemoWorkload, 'id' | 'project_id' | 'phase' | 'created_at' | 'addons'>;
  addons: Omit<DemoAddonAttachment, 'id' | 'created_at'>[];
  variables: DemoStackVariable[];
  created_at: string;
}

export interface DemoStackVariable {
  key: string;
  label: string;
  default_value: string;
  description: string;
}

export interface DemoDeployedStack {
  id: string;
  name: string;
  template_id: string | null;
  template_name: string;
  project_id: string;
  workload_name: string;
  image: string | null;
  addons: string[]; // addon names
  status: 'deploying' | 'running' | 'degraded' | 'failed';
  variables: Record<string, string>;
  created_at: string;
}

export interface DemoCluster {
  id: string;
  name: string;
  description: string | null;
  status: 'pending' | 'connected' | 'disconnected' | 'error';
  kubernetes_version: string | null;
  node_count: number | null;
  base_domain: string | null;
  created_at: string;
}

export interface DemoProject {
  id: string;
  cluster_id: string;
  name: string;
  namespace: string;
  description: string | null;
  registry_secret: string | null;
  status: string;
  created_at: string;
}

const KEYS = {
  workloads: 'demo_workloads',
  templates: 'demo_stack_templates',
  stacks: 'demo_deployed_stacks',
  clusters: 'demo_clusters',
  projects: 'demo_projects',
} as const;

function generateId(): string {
  return crypto.randomUUID();
}

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Workloads ──

export function getDemoWorkloads(projectId: string): DemoWorkload[] {
  return read<DemoWorkload>(KEYS.workloads).filter(w => w.project_id === projectId);
}

export function getDemoWorkload(id: string): DemoWorkload | null {
  return read<DemoWorkload>(KEYS.workloads).find(w => w.id === id) ?? null;
}

export function createDemoWorkload(data: {
  project_id: string;
  name: string;
  source_type: 'image' | 'git';
  image?: string;
  git_repo?: string;
  git_branch?: string;
  dockerfile_path?: string;
  replicas: number;
  port?: number;
  env?: Record<string, string>;
}): DemoWorkload {
  const workload: DemoWorkload = {
    id: generateId(),
    project_id: data.project_id,
    name: data.name,
    source_type: data.source_type,
    image: data.image ?? null,
    git_repo: data.git_repo ?? null,
    git_branch: data.git_branch ?? null,
    dockerfile_path: data.dockerfile_path ?? null,
    replicas: data.replicas,
    port: data.port ?? null,
    env: data.env ?? {},
    phase: 'running', // demo: instantly "running"
    addons: [],
    created_at: new Date().toISOString(),
  };
  const all = read<DemoWorkload>(KEYS.workloads);
  all.push(workload);
  write(KEYS.workloads, all);
  return workload;
}

export function deleteDemoWorkload(id: string): void {
  const all = read<DemoWorkload>(KEYS.workloads).filter(w => w.id !== id);
  write(KEYS.workloads, all);
}

// ── Addon Attachments ──

export function attachAddonToWorkload(workloadId: string, addon: {
  addon_type: string;
  addon_name: string;
  config: Record<string, string>;
  env_bindings: Record<string, string>;
}): DemoAddonAttachment {
  const all = read<DemoWorkload>(KEYS.workloads);
  const workload = all.find(w => w.id === workloadId);
  if (!workload) throw new Error('Workload not found');

  const attachment: DemoAddonAttachment = {
    id: generateId(),
    addon_type: addon.addon_type,
    addon_name: addon.addon_name,
    config: addon.config,
    env_bindings: addon.env_bindings,
    created_at: new Date().toISOString(),
  };
  workload.addons.push(attachment);
  write(KEYS.workloads, all);
  return attachment;
}

export function detachAddonFromWorkload(workloadId: string, addonId: string): void {
  const all = read<DemoWorkload>(KEYS.workloads);
  const workload = all.find(w => w.id === workloadId);
  if (!workload) return;
  workload.addons = workload.addons.filter(a => a.id !== addonId);
  write(KEYS.workloads, all);
}

// ── Stack Templates ──

export function getDemoStackTemplates(): DemoStackTemplate[] {
  return read<DemoStackTemplate>(KEYS.templates);
}

export function getDemoStackTemplate(id: string): DemoStackTemplate | null {
  return read<DemoStackTemplate>(KEYS.templates).find(t => t.id === id) ?? null;
}

export function createStackTemplateFromWorkload(
  workload: DemoWorkload,
  meta: { name: string; description: string; variables: DemoStackVariable[] }
): DemoStackTemplate {
  const template: DemoStackTemplate = {
    id: generateId(),
    name: meta.name,
    description: meta.description,
    source_workload_id: workload.id,
    workload_config: {
      name: workload.name,
      source_type: workload.source_type,
      image: workload.image,
      git_repo: workload.git_repo,
      git_branch: workload.git_branch,
      dockerfile_path: workload.dockerfile_path,
      replicas: workload.replicas,
      port: workload.port,
      env: workload.env,
    },
    addons: workload.addons.map(a => ({
      addon_type: a.addon_type,
      addon_name: a.addon_name,
      config: a.config,
      env_bindings: a.env_bindings,
    })),
    variables: meta.variables,
    created_at: new Date().toISOString(),
  };
  const all = read<DemoStackTemplate>(KEYS.templates);
  all.push(template);
  write(KEYS.templates, all);
  return template;
}

export function deleteDemoStackTemplate(id: string): void {
  const all = read<DemoStackTemplate>(KEYS.templates).filter(t => t.id !== id);
  write(KEYS.templates, all);
}

// ── Deployed Stacks ──

export function getDemoDeployedStacks(): DemoDeployedStack[] {
  return read<DemoDeployedStack>(KEYS.stacks);
}

export function getDemoDeployedStack(id: string): DemoDeployedStack | null {
  return read<DemoDeployedStack>(KEYS.stacks).find(s => s.id === id) ?? null;
}

export function deployDemoStack(data: {
  name: string;
  template_id: string | null;
  template_name: string;
  project_id: string;
  workload_name: string;
  image: string | null;
  addons: string[];
  variables: Record<string, string>;
}): DemoDeployedStack {
  const stack: DemoDeployedStack = {
    id: generateId(),
    name: data.name,
    template_id: data.template_id,
    template_name: data.template_name,
    project_id: data.project_id,
    workload_name: data.workload_name,
    image: data.image,
    addons: data.addons,
    status: 'running',
    variables: data.variables,
    created_at: new Date().toISOString(),
  };
  const all = read<DemoDeployedStack>(KEYS.stacks);
  all.push(stack);
  write(KEYS.stacks, all);
  return stack;
}

export function deleteDemoDeployedStack(id: string): void {
  const all = read<DemoDeployedStack>(KEYS.stacks).filter(s => s.id !== id);
  write(KEYS.stacks, all);
}

// ── Clusters ──

export function getDemoClusters(): DemoCluster[] {
  return read<DemoCluster>(KEYS.clusters);
}

export function getDemoCluster(id: string): DemoCluster | null {
  return read<DemoCluster>(KEYS.clusters).find(c => c.id === id) ?? null;
}

export function createDemoCluster(data: {
  name: string;
  description?: string;
}): DemoCluster {
  const cluster: DemoCluster = {
    id: generateId(),
    name: data.name,
    description: data.description ?? null,
    status: 'connected',
    kubernetes_version: 'v1.30.2',
    node_count: 3,
    base_domain: `${data.name}.kubenest.local`,
    created_at: new Date().toISOString(),
  };
  const all = read<DemoCluster>(KEYS.clusters);
  all.push(cluster);
  write(KEYS.clusters, all);
  return cluster;
}

export function deleteDemoCluster(id: string): void {
  const all = read<DemoCluster>(KEYS.clusters).filter(c => c.id !== id);
  write(KEYS.clusters, all);
  // Also delete projects in this cluster
  const projects = read<DemoProject>(KEYS.projects).filter(p => p.cluster_id !== id);
  write(KEYS.projects, projects);
}

// ── Projects ──

export function getDemoProjects(clusterId?: string): DemoProject[] {
  const all = read<DemoProject>(KEYS.projects);
  return clusterId ? all.filter(p => p.cluster_id === clusterId) : all;
}

export function getDemoProject(id: string): DemoProject | null {
  return read<DemoProject>(KEYS.projects).find(p => p.id === id) ?? null;
}

export function createDemoProject(data: {
  cluster_id: string;
  name: string;
  description?: string;
  registry_secret?: string;
}): DemoProject {
  const project: DemoProject = {
    id: generateId(),
    cluster_id: data.cluster_id,
    name: data.name,
    namespace: data.name,
    description: data.description ?? null,
    registry_secret: data.registry_secret ?? null,
    status: 'active',
    created_at: new Date().toISOString(),
  };
  const all = read<DemoProject>(KEYS.projects);
  all.push(project);
  write(KEYS.projects, all);
  return project;
}

export function deleteDemoProject(id: string): void {
  const all = read<DemoProject>(KEYS.projects).filter(p => p.id !== id);
  write(KEYS.projects, all);
}

// ── All Workloads (across projects) ──

export function getAllDemoWorkloads(): DemoWorkload[] {
  return read<DemoWorkload>(KEYS.workloads);
}
