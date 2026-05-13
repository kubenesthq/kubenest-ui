'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Box,
  Boxes,
  ChevronDown,
  ChevronUp,
  Cloud,
  Database,
  LayoutDashboard,
  Layers,
  Plug,
  Search,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type ComponentType } from 'react';
import { getAllProjects } from '@/api/projects';
import { appsApi } from '@/lib/api/apps';
import { useAuthStore } from '@/store/auth';
import { useCurrentOrg } from '@/hooks/useOrganization';
import { useUiStore } from '@/store/ui';
import { Avatar, glyphColor, Kbd, Pill, SectionLabel, StatusDot, statusTone } from '@/components/shell/primitives';

type IconType = ComponentType<{ size?: number; className?: string }>;

function NavLink({
  icon: Icon,
  iconNode,
  label,
  href,
  exact = false,
  indent = 0,
  badge,
}: {
  icon?: IconType;
  iconNode?: React.ReactNode;
  label: string;
  href: string;
  exact?: boolean;
  indent?: number;
  badge?: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        paddingLeft: 8 + indent * 12,
      }}
      className="w-full flex items-center gap-2 h-7 pr-2 rounded-md text-[12.5px] font-medium hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
    >
      {iconNode ?? (Icon ? <Icon size={13} /> : null)}
      <span className="truncate flex-1 text-left">{label}</span>
      {badge != null && <Pill tone="accent" size="sm">{badge}</Pill>}
    </Link>
  );
}

function UserFooter() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const name = user?.name || user?.email || 'User';
  const email = user?.name ? user?.email : undefined;
  return (
    <div style={{ borderColor: 'var(--border)' }} className="border-t p-2 relative">
      {open && (
        <div
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
          className="absolute bottom-[52px] left-2 right-2 rounded-lg border anim-slide-up overflow-hidden z-10"
        >
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-2)' }}
          >
            Sign out
          </button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 text-left rounded-md p-1 hover:bg-[var(--surface-2)] transition-colors">
        <Avatar name={name} size={28} color="#4f46e5" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium truncate" style={{ color: 'var(--text)' }}>{name}</div>
          {email && <div className="text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{email}</div>}
        </div>
        <ChevronUp size={14} style={{ color: 'var(--text-3)' }} />
      </button>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname() || '';
  const search = useSearchParams();
  const { org } = useCurrentOrg();
  const openCommand = useUiStore((s) => s.openCommand);
  const openOrgSwitcher = useUiStore((s) => s.openOrgSwitcher);
  const [projectsOpen, setProjectsOpen] = useState(true);

  const projectsQ = useQuery({ queryKey: ['projects', 'all'], queryFn: getAllProjects });
  const projects = projectsQ.data?.data ?? [];

  // Active project (for the Railway-style drill-down): /projects/[id] or /apps/[ns]/[name]?project_id=
  const seg = pathname.split('/').filter(Boolean);
  const activeProjectId =
    (seg[0] === 'projects' && seg[1] && seg[1] !== 'new' ? seg[1] : undefined) ||
    (seg[0] === 'apps' && seg[1] && seg[1] !== 'new' ? search.get('project_id') ?? undefined : undefined);
  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : undefined;
  const appsQ = useApps(activeProjectId);

  const orgGlyph = org?.name?.[0]?.toUpperCase() ?? 'K';
  const orgColor = glyphColor(org?.name ?? 'KubeNest');

  return (
    <aside style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} className="w-[240px] shrink-0 h-screen sticky top-0 border-r flex flex-col">
      {/* Org switcher */}
      <button onClick={openOrgSwitcher} style={{ borderColor: 'var(--border)' }} className="m-2 px-2 h-10 rounded-md border flex items-center gap-2 hover:bg-[var(--surface-2)] transition-colors">
        <span style={{ background: orgColor }} className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[12px] font-bold shrink-0">{orgGlyph}</span>
        <span className="flex-1 text-left min-w-0">
          <span className="block text-[12.5px] font-semibold leading-tight truncate" style={{ color: 'var(--text)' }}>{org?.name ?? 'KubeNest'}</span>
          <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{org?.role ? `${org.role}` : 'Organization'}</span>
        </span>
        <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />
      </button>

      {/* Search → command palette */}
      <button onClick={openCommand} style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-3)' }} className="mx-2 mb-3 px-2.5 h-8 rounded-md border flex items-center gap-2 text-[12.5px] hover:border-[var(--border-strong)] transition-colors">
        <Search size={13} />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="space-y-0.5">
          <NavLink icon={LayoutDashboard} label="Dashboard" href="/dashboard" exact />
          <NavLink icon={Box} label="Apps" href="/apps" exact />
        </div>

        <div className="mt-5 mb-1.5 px-2 flex items-center justify-between">
          <SectionLabel>Projects</SectionLabel>
          <button onClick={() => setProjectsOpen((o) => !o)} style={{ color: 'var(--text-3)' }} aria-label="Toggle projects">
            <ChevronDown size={11} style={{ transform: projectsOpen ? '' : 'rotate(-90deg)', transition: 'transform .15s' }} />
          </button>
        </div>
        {projectsOpen && (
          <div className="space-y-0.5">
            {projects.slice(0, 8).map((p) => (
              <NavLink
                key={p.id}
                href={`/projects/${p.id}`}
                exact
                label={p.display_name || p.name}
                iconNode={<StatusDot status={statusTone(p.status)} pulse={false} size={6} />}
              />
            ))}
            {projectsQ.isLoading && <div className="px-2 py-1 text-[11px]" style={{ color: 'var(--text-3)' }}>Loading projects…</div>}
            <Link href="/projects" style={{ color: 'var(--text-3)' }} className="block text-[11.5px] px-2 py-1 hover:text-[var(--text)]">+ New project</Link>
          </div>
        )}

        {/* Drill-down — apps in the currently-open project */}
        {activeProject && (
          <div className="mt-4 pl-2.5 ml-2 border-l" style={{ borderColor: 'var(--border)' }}>
            <SectionLabel className="mb-1">{activeProject.display_name || activeProject.name}</SectionLabel>
            {(appsQ.data?.data ?? []).map((a) => (
              <NavLink
                key={a.uid}
                href={`/apps/${a.namespace}/${a.name}?project_id=${a.project_id}`}
                exact
                label={a.name}
                iconNode={<StatusDot status={statusTone(a.phase)} pulse={statusTone(a.phase) === 'warn'} size={6} />}
              />
            ))}
            {appsQ.isLoading && <div className="px-2 py-1 text-[11px]" style={{ color: 'var(--text-3)' }}>Loading apps…</div>}
            <Link href={`/projects/${activeProject.id}`} style={{ color: 'var(--text-3)' }} className="flex items-center gap-1.5 text-[11.5px] px-2 py-1 hover:text-[var(--text)]">
              <Database size={11} /> Add-ons & secrets
            </Link>
          </div>
        )}

        <div className="mt-5 mb-1.5 px-2"><SectionLabel>Infrastructure</SectionLabel></div>
        <div className="space-y-0.5">
          <NavLink icon={Boxes} label="Clusters" href="/clusters" />
          <NavLink icon={Cloud} label="Cloud providers" href="/settings/cloud-credentials" />
          <NavLink icon={Layers} label="Stack templates" href="/settings/stack-templates" />
          <NavLink icon={Plug} label="Add-ons catalog" href="/admin/addon-definitions" />
        </div>

        <div className="mt-5 mb-1.5 px-2"><SectionLabel>Workspace</SectionLabel></div>
        <div className="space-y-0.5">
          <NavLink icon={Users} label="Members" href="/settings/teams" />
          <NavLink icon={Shield} label="RBAC" href="/settings/rbac" />
          <NavLink icon={Settings} label="Settings" href="/settings" exact />
          <NavLink icon={Activity} label="Activity" href="/activity" />
        </div>
      </div>

      <UserFooter />
    </aside>
  );
}

// Local thin wrapper so we don't import the whole useApps module surface.
function useApps(projectId?: string) {
  return useQuery({
    queryKey: ['apps', { project_id: projectId ?? null }],
    queryFn: () => appsApi.list({ project_id: projectId }),
    enabled: !!projectId,
  });
}
