'use client';

import { Check, ChevronRight, Palette, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useUiStore } from '@/store/ui';
import { Kbd } from '@/components/shell/primitives';
import { useBreadcrumbs } from './use-breadcrumbs';

function useOutsideClose<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);
  return ref;
}

function ThemeMenu() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Theme"
        aria-label="Theme"
        style={{ color: 'var(--text-2)' }}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
      >
        <Palette size={15} />
      </button>
      {open && (
        <div
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
          className="absolute right-0 mt-1.5 w-56 rounded-lg border anim-slide-up overflow-hidden z-40 p-1"
        >
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTheme(t.value); setOpen(false); }}
              style={{ background: t.value === theme ? 'var(--surface-2)' : 'transparent' }}
              className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-[var(--surface-2)] transition-colors text-left"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>{t.label}</span>
                <span className="block text-[10.5px]" style={{ color: 'var(--text-3)' }}>{t.hint}</span>
              </span>
              {t.value === theme && <Check size={14} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(() => setOpen(false));
  const items: { label: string; sub: string; href: string }[] = [
    { label: 'Deploy app', sub: 'From git repo or container image', href: '/apps/new' },
    { label: 'Register cluster', sub: 'Connect an existing k3s cluster', href: '/clusters/new' },
    { label: 'Provision cluster', sub: 'Spin up a new cluster with a cloud provider', href: '/clusters/new/provision' },
  ];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }}
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-[12.5px] font-medium transition-all hover:opacity-90 active:scale-[.98]"
      >
        <Plus size={14} /> Create
      </button>
      {open && (
        <div
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
          className="absolute right-0 mt-1.5 w-60 rounded-lg border anim-slide-up overflow-hidden z-40 p-1"
        >
          {items.map((it) => (
            <button
              key={it.href}
              onClick={() => { setOpen(false); router.push(it.href); }}
              className="w-full flex flex-col gap-0.5 p-2 rounded-md hover:bg-[var(--surface-2)] transition-colors text-left"
            >
              <span className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>{it.label}</span>
              <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{it.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const openCommand = useUiStore((s) => s.openCommand);
  const crumbs = useBreadcrumbs();
  return (
    <header style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} className="h-12 sticky top-0 z-30 border-b flex items-center px-4 gap-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] flex-1 min-w-0">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-4)' }} />}
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-[var(--text)] transition-colors truncate" style={{ color: 'var(--text-3)' }}>
                  {c.label}
                </Link>
              ) : (
                <span style={{ color: last ? 'var(--text)' : 'var(--text-3)' }} className={cn('truncate', last && 'font-medium')}>{c.label}</span>
              )}
            </Fragment>
          );
        })}
      </nav>
      <button
        onClick={openCommand}
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
        className="h-7 w-72 px-2.5 rounded-md border hidden md:flex items-center gap-2 text-[12.5px] hover:border-[var(--border-strong)] transition-colors"
      >
        <Search size={13} />
        <span className="flex-1 text-left truncate">Search anything in this org…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <ThemeMenu />
      <CreateMenu />
    </header>
  );
}
