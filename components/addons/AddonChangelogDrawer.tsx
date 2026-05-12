'use client';

import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AddonVersionHistoryEntry } from '@/types/api';

interface DrawerEntry {
  version: string;
  released_at?: string | null;
  deprecated?: boolean;
  changelog?: string | null;
}

/**
 * Read-only "version history & changelog" drawer for an AddonDefinition — the
 * catalog-admin surface for the chart-version history + per-version release
 * notes (kn-b12 `version_history` / `changelog`). Mounted on the addon
 * definition edit page next to the editable JSON fields.
 */
export function AddonChangelogDrawer({
  versionHistory,
  changelog,
}: {
  versionHistory?: AddonVersionHistoryEntry[] | null;
  changelog?: Record<string, string> | null;
}) {
  const [open, setOpen] = useState(false);

  const entries = useMemo<DrawerEntry[]>(() => {
    const byVersion = new Map<string, DrawerEntry>();
    for (const e of versionHistory ?? []) {
      if (!e?.version) continue;
      byVersion.set(e.version, {
        version: e.version,
        released_at: e.released_at ?? null,
        deprecated: e.deprecated === true,
        changelog: e.changelog ?? (changelog ? changelog[e.version] ?? null : null),
      });
    }
    for (const [version, notes] of Object.entries(changelog ?? {})) {
      if (!byVersion.has(version)) byVersion.set(version, { version, changelog: notes });
    }
    return Array.from(byVersion.values());
  }, [versionHistory, changelog]);

  const count = entries.length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="open-changelog-drawer"
      >
        <History className="h-3.5 w-3.5 mr-1.5" />
        Version history & changelog{count > 0 ? ` (${count})` : ''}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Version history & changelog</DialogTitle>
            <DialogDescription>
              Chart versions published for this addon, newest entries first as recorded.
            </DialogDescription>
          </DialogHeader>
          {count === 0 ? (
            <p className="text-sm text-zinc-400 py-4" data-testid="changelog-empty">
              No version history recorded yet. Add entries below to populate this.
            </p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto" data-testid="changelog-list">
              {entries.map((e) => (
                <div key={e.version} className="rounded-lg border border-zinc-200 p-3" data-testid="changelog-entry">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono">{e.version}</code>
                    {e.deprecated && <span className="text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-100 text-amber-700">deprecated</span>}
                    {e.released_at && <span className="text-xs text-zinc-400">{e.released_at}</span>}
                  </div>
                  {e.changelog ? (
                    <p className="text-sm text-zinc-600 mt-1.5 whitespace-pre-wrap">{e.changelog}</p>
                  ) : (
                    <p className="text-xs text-zinc-400 mt-1.5">No release notes.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
