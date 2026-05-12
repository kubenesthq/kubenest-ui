'use client';

import { usePathname } from 'next/navigation';
import { Suspense, useEffect, type ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useUiStore } from '@/store/ui';
import { CommandPalette } from './CommandPalette';
import { OrgSwitcher } from './OrgSwitcher';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const AUTH_ROUTES = ['/login', '/register'];

function SidebarFallback() {
  return <aside style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} className="w-[240px] shrink-0 h-screen sticky top-0 border-r" aria-hidden />;
}
function TopbarFallback() {
  return <header style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} className="h-12 sticky top-0 z-30 border-b" aria-hidden />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  useTheme(); // keeps <html data-theme> in sync with the persisted theme store
  const toggleCommand = useUiStore((s) => s.toggleCommand);
  const commandOpen = useUiStore((s) => s.commandOpen);
  const orgSwitcherOpen = useUiStore((s) => s.orgSwitcherOpen);

  useEffect(() => {
    if (isAuthRoute) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommand();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthRoute, toggleCommand]);

  if (isAuthRoute) return <>{children}</>;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 min-w-0 flex flex-col">
        <Suspense fallback={<TopbarFallback />}>
          <Topbar />
        </Suspense>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      {commandOpen && <CommandPalette />}
      {orgSwitcherOpen && <OrgSwitcher />}
    </div>
  );
}
