'use client';

import { Building2 } from 'lucide-react';
import { useCurrentOrg, useOrganizations } from '@/hooks/useOrganization';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function OrgSwitcher() {
  const { data: orgs, isLoading } = useOrganizations();
  const { orgId, switchOrg } = useCurrentOrg();

  if (isLoading || !orgs || orgs.length <= 1) {
    // Single org or loading — show static label
    const label = orgs?.[0]?.name ?? 'Loading...';
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  return (
    <Select value={orgId} onValueChange={switchOrg}>
      <SelectTrigger className="h-8 w-full border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-700 focus:ring-1 focus:ring-blue-500">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <SelectValue placeholder="Select organization" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {orgs.map((org) => (
          <SelectItem key={org.id} value={org.id} className="text-xs">
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
