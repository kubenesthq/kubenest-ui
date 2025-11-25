import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWorkloads, getWorkload, createWorkload, deleteWorkload } from '@/api/workloads';
import type { CreateWorkloadRequest } from '@/types/api';

export function useWorkloads(projectId: string) {
  return useQuery({
    queryKey: ['workloads', projectId],
    queryFn: () => getWorkloads(projectId),
    enabled: !!projectId,
  });
}

export function useWorkload(id: string) {
  return useQuery({
    queryKey: ['workload', id],
    queryFn: () => getWorkload(id),
    enabled: !!id,
  });
}

export function useCreateWorkload(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkloadRequest) => createWorkload(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}

export function useDeleteWorkload(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWorkload(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}
