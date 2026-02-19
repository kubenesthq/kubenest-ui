'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Server, Plus, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    matchPaths: ['/dashboard', '/clusters', '/projects', '/workloads'],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <aside className="flex flex-col h-screen w-56 bg-white border-r border-zinc-100 fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-zinc-100 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Server className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm text-zinc-900 tracking-tight">KubeNest</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.matchPaths.some((p) => pathname.startsWith(p));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <item.icon
                className={cn('h-4 w-4 shrink-0', isActive ? 'text-blue-600' : 'text-zinc-400')}
              />
              {item.label}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="pt-3 pb-1 px-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-300">Actions</p>
        </div>

        <Link
          href="/clusters/new"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
            pathname === '/clusters/new'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
          )}
        >
          <Plus
            className={cn(
              'h-4 w-4 shrink-0',
              pathname === '/clusters/new' ? 'text-blue-600' : 'text-zinc-400'
            )}
          />
          Register Cluster
        </Link>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-zinc-100 shrink-0">
        <div className="flex items-center gap-2.5 mb-2 px-1">
          <div className="h-7 w-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-700 truncate">
              {user?.name || user?.email || 'User'}
            </p>
            {user?.name && (
              <p className="text-xs text-zinc-400 truncate">{user.email}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 w-full rounded-md text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
