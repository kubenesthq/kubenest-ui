import { useQuery } from '@tanstack/react-query';
import { getOrganizations } from '@/api/organizations';
import type { Organization } from '@/types/api';

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: getOrganizations,
  });
}

export function useCurrentOrg(): { org: Organization | undefined; orgId: string | undefined; isLoading: boolean } {
  const { data: orgs, isLoading } = useOrganizations();

  // Use the first org as current (single-org MVP).
  // Future: org switcher UI, persisted selection.
  const org = orgs?.[0];

  return {
    org,
    orgId: org?.id,
    isLoading,
  };
}
