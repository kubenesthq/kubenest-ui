import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appsApi } from '@/lib/api/apps';
import type { AppCreate } from '@/types/api';

export function useCreateApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AppCreate) => appsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}
