'use client';

/**
 * Small presentational primitives for the KubeNest app shell, ported faithfully
 * from design-handoff/project/js/ui.jsx. They use the per-theme CSS variables in
 * globals.css (var(--text), var(--surface), var(--accent), …).
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'ok' | 'warn' | 'err' | 'info' | 'idle';

/** Map a backend entity status/phase string to a StatusDot tone. */
export function statusTone(s?: string | null): StatusTone {
  const v = (s ?? '').toLowerCase();
  if (['connected', 'running', 'ready', 'active', 'succeeded', 'healthy', 'ok'].includes(v)) return 'ok';
  if (['pending', 'provisioning', 'deploying', 'building', 'degraded', 'creating', 'destroying'].includes(v)) return 'warn';
  if (['disconnected', 'failed', 'error', 'errored'].includes(v)) return 'err';
  return 'idle';
}

const TONE_COLOR: Record<StatusTone, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  err: 'var(--err)',
  info: 'var(--info)',
  idle: 'var(--text-3)',
};

export function StatusDot({
  status = 'ok',
  size = 8,
  pulse = true,
  label,
}: {
  status?: StatusTone;
  size?: number;
  pulse?: boolean;
  label?: ReactNode;
}) {
  const color = TONE_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex" style={{ width: size, height: size }}>
        <span className="absolute inset-0 rounded-full" style={{ background: color }} />
        {pulse && status !== 'idle' && (
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: color, opacity: 0.4, animation: 'pulse-ring 1.8s ease-out infinite' }}
          />
        )}
      </span>
      {label != null && (
        <span style={{ color: 'var(--text-2)' }} className="text-[12px]">
          {label}
        </span>
      )}
    </span>
  );
}

export type PillTone = 'default' | 'ok' | 'warn' | 'err' | 'info' | 'accent';

const PILL_TONES: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  default: { bg: 'var(--surface-2)', fg: 'var(--text-2)', dot: 'var(--text-3)' },
  ok: { bg: 'var(--ok-soft)', fg: 'var(--ok)', dot: 'var(--ok)' },
  warn: { bg: 'var(--warn-soft)', fg: 'var(--warn)', dot: 'var(--warn)' },
  err: { bg: 'var(--err-soft)', fg: 'var(--err)', dot: 'var(--err)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)', dot: 'var(--info)' },
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)', dot: 'var(--accent)' },
};

export function Pill({
  tone = 'default',
  size = 'md',
  dot = false,
  className = '',
  children,
}: {
  tone?: PillTone;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = PILL_TONES[tone];
  const sz = size === 'sm' ? 'h-5 px-1.5 text-[10.5px]' : 'h-6 px-2 text-[11.5px]';
  return (
    <span style={{ background: t.bg, color: t.fg }} className={cn('inline-flex items-center gap-1.5 rounded-md font-medium', sz, className)}>
      {dot && <span style={{ background: t.dot }} className="w-1.5 h-1.5 rounded-full" />}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div style={{ color: 'var(--text-3)' }} className={cn('text-[10.5px] font-semibold uppercase tracking-[0.08em]', className)}>
      {children}
    </div>
  );
}

const AVATAR_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export function Avatar({ name = '?', size = 24, color }: { name?: string; size?: number; color?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  const c = color || AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <span
      style={{ width: size, height: size, background: c, fontSize: size * 0.42 }}
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0"
    >
      {initials}
    </span>
  );
}

/** A 4-letter-derived deterministic color for an org/cluster glyph tile. */
export function glyphColor(seed: string): string {
  return AVATAR_COLORS[(seed.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}
