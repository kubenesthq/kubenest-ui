'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus, Settings, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createOrganization } from '@/api/organizations';
import { useCurrentOrg, useOrganizations } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { SectionLabel, glyphColor } from '@/components/shell/primitives';

/**
 * Org switcher popover (KubeNest Design). Lists the orgs the user belongs to,
 * switches the active org, and — for superadmins only (ask #14 / Q-default;
 * flips when kn-b17 lands) — creates a new one inline.
 */
export function OrgSwitcher() {
  const open = useUiStore((s) => s.orgSwitcherOpen);
  const close = useUiStore((s) => s.closeOrgSwitcher);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: orgs, isLoading } = useOrganizations();
  const { orgId, switchOrg } = useCurrentOrg();
  const { isSuperadmin } = useAuthStore();

  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const onName = (v: string) => {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
  };

  const submitCreate = async () => {
    if (!name.trim() || !slug.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const org = await createOrganization({ name: name.trim(), slug: slug.trim() });
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      switchOrg(org.id);
      setShowCreate(false);
      setName('');
      setSlug('');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
        className="absolute top-12 left-3 w-80 rounded-xl border anim-slide-up overflow-hidden"
        role="dialog"
        aria-label="Switch organization"
      >
        <div className="p-2">
          <div className="px-2 py-1 flex items-center justify-between">
            <SectionLabel>Switch organization</SectionLabel>
            <button onClick={close} style={{ color: 'var(--text-3)' }} aria-label="Close"><X size={13} /></button>
          </div>

          {isLoading && <div className="px-2 py-3 text-[12px]" style={{ color: 'var(--text-3)' }}>Loading organizations…</div>}

          <div className="mt-1 space-y-0.5">
            {(orgs ?? []).map((o) => {
              const active = o.id === orgId;
              return (
                <button
                  key={o.id}
                  onClick={() => { switchOrg(o.id); close(); }}
                  style={{ background: active ? 'var(--surface-2)' : 'transparent' }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-[var(--surface-2)] transition-colors text-left"
                >
                  <span style={{ background: glyphColor(o.name) }} className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[13px] font-bold shrink-0">{o.name[0]?.toUpperCase()}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{o.name}</span>
                    <span className="block text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{o.slug}{o.role ? ` · ${o.role}` : ''}</span>
                  </span>
                  {active && <Check size={14} style={{ color: 'var(--accent)' }} />}
                </button>
              );
            })}
          </div>

          <div style={{ background: 'var(--border)' }} className="h-px w-full my-1.5" />

          {showCreate ? (
            <div className="p-2 space-y-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => onName(e.target.value)}
                placeholder="Organization name"
                className="w-full rounded-md border px-2.5 h-8 text-[13px] focus:outline-none focus:border-[var(--accent)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="org-slug"
                className="w-full rounded-md border px-2.5 h-8 text-[13px] font-mono focus:outline-none focus:border-[var(--accent)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              {error && <p className="text-[11.5px]" style={{ color: 'var(--err)' }}>{error}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowCreate(false); setError(null); }} className="h-7 px-2.5 rounded-md text-[12px]" style={{ color: 'var(--text-2)' }}>Cancel</button>
                <button
                  onClick={submitCreate}
                  disabled={creating || !name.trim() || !slug.trim()}
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                  className="h-7 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creating && <Loader2 size={12} className="animate-spin" />} Create
                </button>
              </div>
            </div>
          ) : (
            <>
              {isSuperadmin && (
                <button onClick={() => setShowCreate(true)} className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-[var(--surface-2)] transition-colors text-left text-[12.5px]" style={{ color: 'var(--text-2)' }}>
                  <Plus size={14} /> Create new organization…
                </button>
              )}
              <button onClick={() => { close(); router.push('/settings'); }} className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-[var(--surface-2)] transition-colors text-left text-[12.5px]" style={{ color: 'var(--text-2)' }}>
                <Settings size={14} /> Organization settings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
