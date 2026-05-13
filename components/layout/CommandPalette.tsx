'use client';

import { useQuery } from '@tanstack/react-query';
import { Box, Boxes, Folder, Layers, Plug, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { getAllProjects } from '@/api/projects';
import { appsApi } from '@/lib/api/apps';
import { getRecents, pushRecent, type Recent } from '@/lib/recents';
import { stackTemplatesApi } from '@/lib/api/stack-templates';
import { useClusters } from '@/hooks/useClusters';
import { useUiStore } from '@/store/ui';
import { Kbd, SectionLabel, StatusDot, statusTone, type StatusTone } from '@/components/shell/primitives';

type IconType = ComponentType<{ size?: number }>;

function PalGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-3 py-1"><SectionLabel>{label}</SectionLabel></div>
      <div>{children}</div>
    </div>
  );
}

function PalItem({ icon: Icon, title, sub, status, hint, onClick }: { icon: IconType; title: string; sub?: string; status?: StatusTone; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--surface-2)] transition-colors text-left">
      <span style={{ color: 'var(--text-3)' }} className="shrink-0"><Icon size={15} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{title}</span>
        {sub && <span className="block text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>{sub}</span>}
      </span>
      {status && <StatusDot status={status} pulse={false} />}
      {hint && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{hint}</span>}
    </button>
  );
}

// Mounted only while open (AppShell does `{commandOpen && <CommandPalette/>}`),
// so component state resets each time it opens.
export function CommandPalette() {
  const close = useUiStore((s) => s.closeCommand);
  const router = useRouter();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Live data — client-side search over loaded entities (no mocks).
  const clustersQ = useClusters();
  const projectsQ = useQuery({ queryKey: ['projects', 'all'], queryFn: getAllProjects });
  const appsQ = useQuery({ queryKey: ['apps', { project_id: null }], queryFn: () => appsApi.list() });
  const templatesQ = useQuery({ queryKey: ['stack-templates', undefined], queryFn: () => stackTemplatesApi.list() });

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, [close]);

  const recents = useMemo(() => getRecents(), []);

  const ql = q.trim().toLowerCase();
  const match = (s?: string | null) => !!s && s.toLowerCase().includes(ql);

  const go = (href: string, recent?: Omit<Recent, 'ts'>) => {
    if (recent) pushRecent(recent);
    close();
    router.push(href);
  };

  const clusters = (clustersQ.data?.data ?? []).filter((c) => !ql || match(c.name) || match(c.status)).slice(0, 5);
  const projects = (projectsQ.data?.data ?? []).filter((p) => !ql || match(p.name) || match(p.display_name) || match(p.namespace)).slice(0, 5);
  const apps = (appsQ.data?.data ?? []).filter((a) => !ql || match(a.name) || match(a.namespace)).slice(0, 6);
  const templates = (templatesQ.data?.data ?? []).filter((t) => !ql || match(t.name) || match(t.namespace)).slice(0, 4);

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh]" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 640 }}
        className="rounded-xl border anim-slide-up overflow-hidden"
        role="dialog"
        aria-label="Command palette"
      >
        <div style={{ borderBottomColor: 'var(--border)' }} className="border-b px-3 py-2.5 flex items-center gap-2">
          <Search size={16} style={{ color: 'var(--text-3)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search apps, projects, clusters, templates…"
            className="flex-1 bg-transparent outline-none text-[14px]"
            style={{ color: 'var(--text)' }}
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto py-1">
          {!ql && recents.length > 0 && (
            <PalGroup label="Recent">
              {recents.map((rc) => (
                <PalItem
                  key={rc.kind + rc.id}
                  icon={rc.kind === 'app' ? Box : rc.kind === 'project' ? Folder : Boxes}
                  title={rc.label}
                  sub={rc.sub}
                  onClick={() => go(rc.href)}
                />
              ))}
            </PalGroup>
          )}
          {apps.length > 0 && (
            <PalGroup label="Apps">
              {apps.map((a) => (
                <PalItem
                  key={a.uid}
                  icon={Box}
                  title={a.name}
                  sub={`${a.namespace} · ${a.phase}`}
                  status={statusTone(a.phase)}
                  onClick={() => go(`/apps/${a.namespace}/${a.name}?project_id=${a.project_id}`, { kind: 'app', id: a.uid, label: a.name, sub: a.namespace, href: `/apps/${a.namespace}/${a.name}?project_id=${a.project_id}` })}
                />
              ))}
            </PalGroup>
          )}
          {projects.length > 0 && (
            <PalGroup label="Projects">
              {projects.map((p) => (
                <PalItem
                  key={p.id}
                  icon={Folder}
                  title={p.display_name || p.name}
                  sub={p.namespace}
                  status={statusTone(p.status)}
                  onClick={() => go(`/projects/${p.id}`, { kind: 'project', id: p.id, label: p.display_name || p.name, sub: p.namespace, href: `/projects/${p.id}` })}
                />
              ))}
            </PalGroup>
          )}
          {clusters.length > 0 && (
            <PalGroup label="Clusters">
              {clusters.map((c) => (
                <PalItem
                  key={c.id}
                  icon={Boxes}
                  title={c.name}
                  sub={[c.kubernetes_version, c.node_count != null ? `${c.node_count} nodes` : null].filter(Boolean).join(' · ') || c.status}
                  status={statusTone(c.status)}
                  onClick={() => go(`/clusters/${c.id}`, { kind: 'cluster', id: c.id, label: c.name, sub: c.status, href: `/clusters/${c.id}` })}
                />
              ))}
            </PalGroup>
          )}
          {templates.length > 0 && (
            <PalGroup label="Stack templates">
              {templates.map((t) => (
                <PalItem key={`${t.namespace}/${t.name}`} icon={Layers} title={t.name} sub={t.namespace} onClick={() => go(`/settings/stack-templates/${t.namespace}/${t.name}`)} />
              ))}
            </PalGroup>
          )}
          {!ql && (
            <PalGroup label="Actions">
              <PalItem icon={Plus} title="Deploy app" sub="From git repo or container image" onClick={() => go('/apps/new')} />
              <PalItem icon={Plus} title="Register cluster" sub="Connect an existing k3s cluster" onClick={() => go('/clusters/new')} />
              <PalItem icon={Plug} title="Browse add-ons catalog" sub="Databases, caches, queues…" onClick={() => go('/admin/addon-definitions')} />
              <PalItem icon={Layers} title="Browse stack templates" sub="Reusable across the org" onClick={() => go('/settings/stack-templates')} />
            </PalGroup>
          )}
          {ql && apps.length + projects.length + clusters.length + templates.length === 0 && (
            <div className="px-3 py-8 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>No matches for “{q}”.</div>
          )}
        </div>
        <div style={{ borderTopColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)' }} className="border-t px-3 py-1.5 text-[11px] flex items-center gap-3">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="ml-auto">client-side search over loaded entities</span>
        </div>
      </div>
    </div>
  );
}
