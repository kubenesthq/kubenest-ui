import { apiClient } from '../api-client';

// -- Types matching backend schemas --

export interface StackTemplateRead {
  name: string;
  namespace: string;
  description: string | null;
  version: string;
  scope: string;
  icon: string | null;
  tags: string[] | null;
  components: StackTemplateComponent[];
  parameters: Record<string, ParameterSpec> | null;
  created_at: string | null;
}

export interface StackTemplateComponent {
  name: string;
  type: 'workload' | 'addon';
  dependsOn?: string[];
  workloadSpec?: Record<string, unknown>;
  addonSpec?: Record<string, unknown>;
}

export interface ParameterSpec {
  type: 'string' | 'integer' | 'boolean';
  description?: string;
  default?: unknown;
  required: boolean;
  component: string;
  path: string;
  generator?: string;
}

export interface StackTemplateList {
  data: StackTemplateRead[];
  total_count: number;
}

export interface RegistryTemplateSummary {
  name: string;
  description: string | null;
  version: string;
  tags: string[] | null;
  icon: string | null;
  source_url: string;
}

export interface RegistryTemplateList {
  data: RegistryTemplateSummary[];
  total_count: number;
}

export interface StackTemplateDeploy {
  project_id: string;
  parameters?: Record<string, unknown>;
  timeout?: string;
}

export interface StackDeployComponent {
  name: string;
  type: string;
}

export interface StackDeployRead {
  name: string;
  namespace: string;
  template_name: string;
  template_version: string;
  phase: string;
  message: string | null;
  component_count: number;
  components: StackDeployComponent[];
  project_id: string | null;
  created_at: string | null;
}

export interface StackDeployList {
  data: StackDeployRead[];
  total_count: number;
}

export interface StackTemplateCreate {
  name: string;
  description?: string;
  version?: string;
  scope?: 'global' | 'cluster' | 'project';
  icon?: string;
  tags?: string[];
  components: Array<{
    name: string;
    type: 'workload' | 'addon';
    depends_on?: string[];
    workload_spec?: Record<string, unknown>;
    addon_spec?: Record<string, unknown>;
  }>;
  parameters?: Record<string, unknown>;
}

export interface StackTemplateFromProject {
  name: string;
  description?: string;
  version?: string;
  scope?: 'global' | 'cluster' | 'project';
  icon?: string;
  tags?: string[];
}

// -- API client --

export const stackTemplatesApi = {
  list: (params?: { namespace?: string; scope?: string }) => {
    const query = new URLSearchParams();
    if (params?.namespace) query.set('namespace', params.namespace);
    if (params?.scope) query.set('scope', params.scope);
    const qs = query.toString();
    return apiClient.get<StackTemplateList>(`/stack-templates${qs ? `?${qs}` : ''}`);
  },

  get: (namespace: string, name: string) =>
    apiClient.get<StackTemplateRead>(`/stack-templates/${namespace}/${name}`),

  create: (data: StackTemplateCreate) =>
    apiClient.post<StackTemplateRead>('/stack-templates', data),

  createFromProject: (projectId: string, data: StackTemplateFromProject) =>
    apiClient.post<StackTemplateRead>(`/stack-templates/from-project/${projectId}`, data),

  delete: (namespace: string, name: string) =>
    apiClient.delete<void>(`/stack-templates/${namespace}/${name}`),

  deploy: (namespace: string, name: string, data: StackTemplateDeploy) =>
    apiClient.post<{ message: string; deploy_name: string; namespace: string }>(
      `/stack-templates/${namespace}/${name}/deploy`,
      data
    ),

  // Registry (community templates)
  listRegistry: () =>
    apiClient.get<RegistryTemplateList>('/stack-templates/registry'),

  getRegistry: (name: string) =>
    apiClient.get<StackTemplateRead>(`/stack-templates/registry/${name}`),

  installRegistry: (name: string, namespace: string) =>
    apiClient.post<StackTemplateRead>(
      `/stack-templates/registry/${name}/install?namespace=${encodeURIComponent(namespace)}`,
      {}
    ),

  listDeploys: (orgId: string) =>
    apiClient.get<StackDeployList>(`/stack-deploys?org_id=${orgId}`),
};
