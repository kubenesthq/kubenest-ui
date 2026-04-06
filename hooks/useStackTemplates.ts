import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stackTemplatesApi, type StackTemplateCreate, type StackTemplateDeploy } from '@/lib/api/stack-templates';

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

export function useRegistryTemplates() {
  return useQuery({
    queryKey: ['stack-templates-registry'],
    queryFn: () => stackTemplatesApi.listRegistry(),
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
    mutationFn: ({ name, namespace }: { name: string; namespace: string }) =>
      stackTemplatesApi.installRegistry(name, namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stack-templates'] });
    },
  });
}
