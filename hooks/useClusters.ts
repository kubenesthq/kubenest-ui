import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clustersApi } from '@/lib/api/clusters';
import type { ClusterCreateRequest } from '@/types/api';

export function useClusters() {
  return useQuery({
    queryKey: ['clusters'],
    queryFn: clustersApi.list,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useCluster(id: string) {
  return useQuery({
    queryKey: ['clusters', id],
    queryFn: () => clustersApi.get(id),
    enabled: !!id,
    refetchInterval: 10000, // Refetch every 10 seconds for detail view
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

  return useMutation({
    mutationFn: (data: ClusterCreateRequest) => clustersApi.create(data),
    onSuccess: () => {
      // Invalidate clusters list to refetch
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}

export function useDeleteCluster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clustersApi.delete(id),
    onSuccess: () => {
      // Invalidate clusters list to refetch
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}
