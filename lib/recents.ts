/**
 * "Recently visited" entities, kept in localStorage. Written by the ⌘K command
 * palette (and anywhere else that navigates to an entity); read by the Dashboard
 * "jump back in" card. Pure client-side — no backend.
 */
const RECENTS_KEY = 'kn-recents';

export type RecentKind = 'app' | 'project' | 'cluster' | 'template';

export interface Recent {
  kind: RecentKind;
  id: string;
  label: string;
  sub?: string;
  href: string;
  ts: number;
}

export function getRecents(): Recent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as Recent[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(r: Omit<Recent, 'ts'>): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getRecents().filter((x) => !(x.kind === r.kind && x.id === r.id));
    list.unshift({ ...r, ts: Date.now() });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* ignore quota / disabled storage */
  }
}
