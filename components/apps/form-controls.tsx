'use client';

/**
 * Token-styled form controls used by the app create/edit surfaces.
 *
 * Originally inlined inside `app/apps/new/page.tsx`; lifted here so the
 * app-detail Add/Edit-component drawers (kn-a4l) can reuse them without
 * duplicating the CSS-token wiring.
 */
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

export function TInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`h-8 w-full rounded-md border px-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 ${className}`}
    />
  );
}

export function TSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', style, children, ...rest } = props;
  return (
    <select
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`h-9 w-full rounded-md border px-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 ${className}`}
    >
      {children}
    </select>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--text-3)' }}>
      {children}
      {required && <span style={{ color: 'var(--err)' }} className="ml-0.5">*</span>}
    </label>
  );
}
