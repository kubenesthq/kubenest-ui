'use client';

import { usePathname } from 'next/navigation';
import { AppSidebar } from './AppSidebar';

const AUTH_ROUTES = ['/login', '/register'];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <AppSidebar />
      <main className="flex-1 ml-56 min-h-screen bg-zinc-50">
        {children}
      </main>
    </div>
  );
}
