import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workloadSecretsApi } from '@/lib/api/workload-secrets';

export function useWorkloadSecrets(workloadId: string) {
  return useQuery({
    queryKey: ['workload-secrets', workloadId],
    queryFn: () => workloadSecretsApi.list(workloadId),
    enabled: !!workloadId,
  });
}

export function useSetWorkloadSecrets(workloadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (secrets: Record<string, string>) =>
      workloadSecretsApi.set(workloadId, secrets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload-secrets', workloadId] });
    },
  });
}

export function useUpdateWorkloadSecrets(workloadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (secrets: Record<string, string>) =>
      workloadSecretsApi.update(workloadId, secrets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload-secrets', workloadId] });
    },
  });
}

export function useRemoveWorkloadSecret(workloadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      workloadSecretsApi.remove(workloadId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workload-secrets', workloadId] });
    },
  });
}
