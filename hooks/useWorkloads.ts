import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workloadsApi } from '@/lib/api/workloads';
import type { CreateWorkloadRequest } from '@/types/api';

// Hook to get a single workload
export function useWorkload(id: string) {
  return useQuery({
    queryKey: ['workload', id],
    queryFn: async () => {
      const response = await workloadsApi.get(id);
      return { data: response };
    },
    enabled: !!id,
  });
}

// Hook to get all workloads for a project
export function useWorkloads(projectId: string) {
  return useQuery({
    queryKey: ['workloads', projectId],
    queryFn: async () => {
      const response = await workloadsApi.list(projectId);
      return { data: response.items };
    },
    enabled: !!projectId,
  });
}

// Hook to create a workload
export function useCreateWorkload(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWorkloadRequest) => {
      const response = await workloadsApi.create(projectId, data);
      return { data: response };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads', projectId] });
    },
  });
}

// Hook to scale a workload
export function useScaleWorkload(workloadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (replicas: number) => {
      const response = await workloadsApi.scale(workloadId, { replicas });
      return { data: response };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload', workloadId] });
    },
  });
}

// Hook to delete a workload
export function useDeleteWorkload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workloadId: string) => workloadsApi.delete(workloadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads'] });
    },
  });
}
