'use client';

import { useState } from 'react';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { useCurrentOrg, useOrganizations } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth';
import { createOrganization } from '@/api/organizations';
import { useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CREATE_ORG_VALUE = '__create_new__';

export function OrgSwitcher() {
  const { data: orgs, isLoading } = useOrganizations();
  const { orgId, switchOrg } = useCurrentOrg();
  const { isSuperadmin } = useAuthStore();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !orgs) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="truncate">Loading...</span>
      </div>
    );
  }

  function handleValueChange(value: string) {
    if (value === CREATE_ORG_VALUE) {
      setShowCreate(true);
    } else {
      switchOrg(value);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
  }

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const org = await createOrganization({ name: name.trim(), slug: slug.trim() });
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      switchOrg(org.id);
      setShowCreate(false);
      setName('');
      setSlug('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Select value={orgId} onValueChange={handleValueChange}>
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
          {isSuperadmin && (
            <SelectItem value={CREATE_ORG_VALUE} className="text-xs text-blue-600">
              <div className="flex items-center gap-1.5">
                <Plus className="h-3 w-3" />
                New Organization
              </div>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug</Label>
              <Input
                id="org-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-organization"
              />
              <p className="text-xs text-zinc-500">URL-friendly identifier. Auto-generated from name.</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim() || !slug.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
