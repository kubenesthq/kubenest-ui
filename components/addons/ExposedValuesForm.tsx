'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Renders the form for an AddonDefinition's `exposed_values` descriptor — a
 * flat `{ "dotted.key.path": { type?, description?, title?, default?, enum?,
 * required? } }` map (see the seeded postgres AddonDefinition). Used both in the
 * provision wizard (fresh, fields seeded from each descriptor's `default`) and
 * in the addon-instance Values tab (fields prefilled from the instance's current
 * `chart_config.values` via `initialValues`). Reports the entered overrides up
 * as a nested values object (dotted paths expanded); empty fields are omitted so
 * they fall back to the chart / definition defaults server-side. Mount with a
 * `key` keyed on the definition id (and, when editing, the instance's
 * `updated_at`) so it resets when the source changes.
 */

interface FieldDesc {
  type?: string;
  description?: string;
  title?: string;
  default?: unknown;
  enum?: unknown[];
  required?: boolean;
}

function parseField(raw: unknown): FieldDesc {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      type: typeof o.type === 'string' ? o.type : undefined,
      description: typeof o.description === 'string' ? o.description : undefined,
      title: typeof o.title === 'string' ? o.title : typeof o.label === 'string' ? o.label : undefined,
      default: o.default,
      enum: Array.isArray(o.enum) ? o.enum : undefined,
      required: o.required === true,
    };
  }
  return { default: raw };
}

function setDeep(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null || Array.isArray(cur[k])) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function getDeep(obj: Record<string, unknown> | undefined | null, path: string): unknown {
  if (!obj) return undefined;
  let cur: unknown = obj;
  for (const k of path.split('.')) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur) && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return cur;
}

function coerce(type: string | undefined, raw: string): unknown {
  if (type === 'boolean') return raw === 'true';
  if (type === 'number' || type === 'integer') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

export function ExposedValuesForm({
  exposedValues,
  onChange,
  initialValues,
}: {
  exposedValues: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  /** Current values to prefill from (the instance's `chart_config.values` when editing). */
  initialValues?: Record<string, unknown> | null;
}) {
  const fields = useMemo(
    () => Object.entries(exposedValues).map(([key, raw]) => ({ key, ...parseField(raw) })),
    [exposedValues],
  );
  const [state, setState] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [key, raw] of Object.entries(exposedValues)) {
      const cur = getDeep(initialValues, key);
      const d = cur !== undefined ? cur : parseField(raw).default;
      init[key] = d == null ? '' : String(d);
    }
    return init;
  });

  useEffect(() => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = state[f.key];
      if (raw == null || raw === '') continue; // empty -> fall back to default_values server-side
      setDeep(out, f.key, coerce(f.type, raw));
    }
    onChange(out);
    // onChange is expected to be a stable setter; deliberately not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, fields]);

  if (fields.length === 0) return null;
  const update = (k: string, v: string) => setState((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-3" data-testid="exposed-values-form">
      {fields.map((f) => {
        const id = `xv-${f.key}`;
        return (
          <div key={f.key}>
            <Label htmlFor={id} className="text-xs font-medium text-zinc-600 mb-1 block">
              {f.title ?? f.key}{f.required && <span className="text-red-500"> *</span>} <span className="font-mono text-zinc-400">{f.key}</span>
            </Label>
            {f.enum ? (
              <select id={id} value={state[f.key]} onChange={(e) => update(f.key, e.target.value)} className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {f.enum.map((opt) => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
              </select>
            ) : f.type === 'boolean' ? (
              <select id={id} value={state[f.key]} onChange={(e) => update(f.key, e.target.value)} className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">(default)</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <Input id={id} type={f.type === 'number' || f.type === 'integer' ? 'number' : 'text'} value={state[f.key]} placeholder={f.default == null ? '' : String(f.default)} onChange={(e) => update(f.key, e.target.value)} />
            )}
            {f.description && <p className="text-xs text-zinc-400 mt-1">{f.description}</p>}
          </div>
        );
      })}
    </div>
  );
}
