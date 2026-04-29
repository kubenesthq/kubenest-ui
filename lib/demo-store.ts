/**
 * Demo localStorage store for clusters, projects, and deployed stacks.
 * Used for demo/presentation purposes — no backend calls.
 *
 * Workload-specific demo state was removed alongside the /workloads backend
 * (9i2.9). Only cluster/project/deployed-stack scaffolding remains.
 */

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

