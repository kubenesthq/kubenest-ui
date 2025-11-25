import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workloadsApi, type ScaleWorkloadRequest } from '@/lib/api/workloads';
import type { CreateWorkloadRequest } from '@/types/api';

export function useWorkloads(projectId: string) {
  return useQuery({
    queryKey: ['workloads', projectId],
    queryFn: () => workloadsApi.list(projectId),
    enabled: !!projectId,
    refetchInterval: 10000, // Refetch every 10 seconds for status updates
  });
}

export function useWorkload(workloadId: string) {
  return useQuery({
    queryKey: ['workload', workloadId],
    queryFn: () => workloadsApi.get(workloadId),
    enabled: !!workloadId,
    refetchInterval: 5000, // Refetch every 5 seconds for detailed status
  });
}

export function useCreateWorkload(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkloadRequest) =>
      workloadsApi.create(projectId, data),
    onSuccess: () => {
      // Invalidate workloads list to refetch
      queryClient.invalidateQueries({ queryKey: ['workloads', projectId] });
    },
  });
}

export function useScaleWorkload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workloadId,
      replicas,
    }: {
      workloadId: string;
      replicas: number;
    }) => workloadsApi.scale(workloadId, { replicas }),
    onMutate: async ({ workloadId, replicas }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['workload', workloadId] });

      // Snapshot previous value
      const previousWorkload = queryClient.getQueryData(['workload', workloadId]);

      // Optimistically update to the new value
      queryClient.setQueryData(['workload', workloadId], (old: any) => {
        if (!old) return old;
        return { ...old, replicas };
      });

      // Return context with previous value
      return { previousWorkload, workloadId };
    },
    onError: (err, variables, context) => {
      // Rollback to previous value on error
      if (context?.previousWorkload) {
        queryClient.setQueryData(
          ['workload', context.workloadId],
          context.previousWorkload
        );
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate both single workload and workloads list
      queryClient.invalidateQueries({ queryKey: ['workload', variables.workloadId] });
      // Invalidate all workloads lists (we don't know the projectId here)
      queryClient.invalidateQueries({ queryKey: ['workloads'] });
    },
  });
}

export function useDeleteWorkload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workloadId: string) => workloadsApi.delete(workloadId),
    onSuccess: () => {
      // Invalidate all workloads lists
      queryClient.invalidateQueries({ queryKey: ['workloads'] });
    },
  });
}

export function useRedeployWorkload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workloadId: string) => workloadsApi.redeploy(workloadId),
    onSuccess: (data, workloadId) => {
      // Invalidate both single workload and workloads list
      queryClient.invalidateQueries({ queryKey: ['workload', workloadId] });
      queryClient.invalidateQueries({ queryKey: ['workloads'] });
    },
  });
}
