import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getOrganizations } from '@/api/organizations';
import { useAuthStore } from '@/store/auth';
import type { Organization } from '@/types/api';

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: getOrganizations,
  });
}

export function useCurrentOrg(): {
  org: Organization | undefined;
  orgId: string | undefined;
  isLoading: boolean;
  switchOrg: (orgId: string) => void;
} {
  const { data: orgs, isLoading } = useOrganizations();
  const { activeOrgId, setActiveOrgId } = useAuthStore();
  const queryClient = useQueryClient();

  // Find the active org, or fall back to first available
  const org = orgs?.find((o) => o.id === activeOrgId) ?? orgs?.[0];

  // Auto-set activeOrgId when orgs load and none is selected (or selection is stale)
  useEffect(() => {
    if (org && org.id !== activeOrgId) {
      setActiveOrgId(org.id);
    }
  }, [org, activeOrgId, setActiveOrgId]);

  function switchOrg(newOrgId: string) {
    setActiveOrgId(newOrgId);
    // Invalidate org-scoped queries so they refetch with the new org
    queryClient.invalidateQueries({ queryKey: ['clusters'] });
    queryClient.invalidateQueries({ queryKey: ['cloud-credentials'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['workloads'] });
    queryClient.invalidateQueries({ queryKey: ['addon-instances'] });
    queryClient.invalidateQueries({ queryKey: ['registry-secrets'] });
  }

  return {
    org,
    orgId: org?.id,
    isLoading,
    switchOrg,
  };
}
