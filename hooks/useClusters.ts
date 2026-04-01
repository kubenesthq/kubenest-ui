import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clustersApi } from '@/lib/api/clusters';
import type { ClusterCreateRequest } from '@/types/api';
import { useCurrentOrg } from '@/hooks/useOrganization';

export function useClusters() {
  const { orgId } = useCurrentOrg();

  return useQuery({
    queryKey: ['clusters', orgId],
    queryFn: () => clustersApi.list(orgId!),
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}

export function useCluster(id: string) {
  return useQuery({
    queryKey: ['clusters', id],
    queryFn: () => clustersApi.get(id),
    enabled: !!id,
    refetchInterval: 10000,
  });
}

export function useClusterProjects(clusterId: string) {
  return useQuery({
    queryKey: ['clusters', clusterId, 'projects'],
    queryFn: () => clustersApi.getProjects(clusterId),
    enabled: !!clusterId,
  });
}

export function useCreateCluster() {
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrg();

  return useMutation({
    mutationFn: (data: ClusterCreateRequest) => clustersApi.create(orgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}

export function useDeleteCluster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clustersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}
