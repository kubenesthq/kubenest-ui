import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  stackTemplatesApi,
  type RegistrySource,
  type StackTemplateCreate,
  type StackTemplateDeploy,
  type StackTemplateFromApp,
  type StackTemplateFromChart,
} from '@/lib/api/stack-templates';
import type { ChartSpec } from '@/types/api';

export function useStackTemplates(params?: { namespace?: string; scope?: string }) {
  return useQuery({
    queryKey: ['stack-templates', params],
    queryFn: () => stackTemplatesApi.list(params),
  });
}

export function useStackTemplate(namespace: string, name: string) {
  return useQuery({
    queryKey: ['stack-template', namespace, name],
    queryFn: () => stackTemplatesApi.get(namespace, name),
    enabled: !!namespace && !!name,
  });
}

export function useRegistryTemplates(source?: RegistrySource) {
  return useQuery({
    queryKey: ['stack-templates-registry', source],
    queryFn: () => stackTemplatesApi.listRegistry(source),
  });
}

export function useCreateStackTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StackTemplateCreate) => stackTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stack-templates'] });
    },
  });
}

export function useCreateStackTemplateFromApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      project_id: string;
      namespace: string;
      name: string;
      data: StackTemplateFromApp;
    }) => stackTemplatesApi.createFromApp(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stack-templates'] });
    },
  });
}

export function useCreateStackTemplateFromChart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StackTemplateFromChart) => stackTemplatesApi.createFromChart(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stack-templates'] });
    },
  });
}

// kn-3nm: chart inspection is user-triggered (the 'Inspect chart' button in
// the from-chart wizard), so we expose it as a mutation rather than a query.
// Caller decides when to fire and gets isPending / error for the UI.
export function useInspectChart() {
  return useMutation({
    mutationFn: (chart: ChartSpec) => stackTemplatesApi.inspectChart(chart),
  });
}

export function useDeleteStackTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      stackTemplatesApi.delete(namespace, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stack-templates'] });
    },
  });
}

export function useDeployStackTemplate(namespace: string, name: string) {
  return useMutation({
    mutationFn: (data: StackTemplateDeploy) =>
      stackTemplatesApi.deploy(namespace, name, data),
  });
}

export function useInstallRegistryTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, namespace, source }: { name: string; namespace: string; source?: RegistrySource }) =>
      stackTemplatesApi.installRegistry(name, namespace, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stack-templates'] });
      queryClient.invalidateQueries({ queryKey: ['stack-templates-registry'] });
    },
  });
}
