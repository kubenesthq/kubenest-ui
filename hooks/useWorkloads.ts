import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWorkload,
  getWorkloads,
  createWorkload,
  scaleWorkload,
  deleteWorkload
} from '@/api/workloads';
import type { CreateWorkloadRequest } from '@/types/api';

// Hook to get a single workload
export function useWorkload(id: string) {
  return useQuery({
    queryKey: ['workload', id],
    queryFn: () => getWorkload(id),
    enabled: !!id,
  });
}

// Hook to get all workloads for a project
export function useWorkloads(projectId: string) {
  return useQuery({
    queryKey: ['workloads', projectId],
    queryFn: () => getWorkloads(projectId),
    enabled: !!projectId,
  });
}

// Hook to create a workload
export function useCreateWorkload(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkloadRequest) => createWorkload(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads', projectId] });
    },
  });
}

// Hook to scale a workload
export function useScaleWorkload(workloadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (replicas: number) => scaleWorkload(workloadId, replicas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload', workloadId] });
    },
  });
}

// Hook to delete a workload
export function useDeleteWorkload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workloadId: string) => deleteWorkload(workloadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads'] });
    },
  });
}
