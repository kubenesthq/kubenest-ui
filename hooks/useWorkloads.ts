import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workloadsApi, projectExportsApi } from '@/lib/api/workloads';
import type { CreateWorkloadRequest, WorkloadUpdateRequest } from '@/types/api';

export function useWorkload(id: string) {
  return useQuery({
    queryKey: ['workload', id],
    queryFn: () => workloadsApi.get(id),
    enabled: !!id,
  });
}

export function useWorkloads(projectId: string) {
  return useQuery({
    queryKey: ['workloads', projectId],
    queryFn: () => workloadsApi.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateWorkload(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CreateWorkloadRequest, 'project_id'>) =>
      workloadsApi.create({ ...data, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads', projectId] });
    },
  });
}

export function useUpdateWorkload(workloadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkloadUpdateRequest) =>
      workloadsApi.update(workloadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload', workloadId] });
    },
  });
}

export function useScaleWorkload(workloadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (replicas: number) =>
      workloadsApi.scale(workloadId, { replicas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload', workloadId] });
    },
  });
}

export function useDeleteWorkload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workloadId: string) => workloadsApi.delete(workloadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads'] });
    },
  });
}

export function useAvailableExports(projectId: string) {
  return useQuery({
    queryKey: ['available-exports', projectId],
    queryFn: () => projectExportsApi.getAvailableExports(projectId),
    enabled: !!projectId,
  });
}
