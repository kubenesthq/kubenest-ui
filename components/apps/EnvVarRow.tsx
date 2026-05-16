'use client';

/**
 * Environment-variable editor row used inside the app create flow (and, once
 * kn-a4l lands, the app-detail Add/Edit-component drawer).
 *
 * Originally inlined inside `app/apps/new/page.tsx`; lifted here so the same
 * editor — including the "link to an addon export" picker — can be reused
 * verbatim from the app-detail drawer without copy-paste drift.
 */
import { useState } from 'react';
import { AlertTriangle, Link2, X } from 'lucide-react';
import { TInput } from './form-controls';
import type { AddonDefinition, AppEnvVar } from '@/types/api';

/**
 * Minimal shape EnvVarRow needs from each addon component to render the
 * "link to an exported value" picker. The create-app flow's local
 * `ComponentEntry` already satisfies this shape, and the app-detail drawer
 * can adapt `AppReadComponent` into the same shape (id, name, and the addon
 * definition id) without exposing the rest of its state machine.
 */
export interface EnvVarRowAddonRef {
  id: string;
  name: string;
  addon?: { definitionId: string };
}

export function EnvVarRow({
  envVar,
  index,
  onUpdate,
  onRemove,
  addonComponents,
  addonDefinitions,
}: {
  envVar: AppEnvVar;
  index: number;
  onUpdate: (index: number, env: AppEnvVar) => void;
  onRemove: (index: number) => void;
  addonComponents: EnvVarRowAddonRef[];
  addonDefinitions: AddonDefinition[];
}) {
  const [showExportPicker, setShowExportPicker] = useState(false);
  const isLinked = !!envVar.export_ref;
  const brokenRef = isLinked && !addonComponents.some((c) => c.name === envVar.export_ref!.component);

  return (
    <div className="flex items-start gap-2 group">
      <div className="flex-1 min-w-0">
        <TInput
          placeholder="KEY"
          value={envVar.name}
          onChange={(e) => onUpdate(index, { ...envVar, name: e.target.value })}
          className="font-mono"
        />
      </div>
      <div className="flex-1 min-w-0 relative">
        {isLinked ? (
          <div
            className="h-8 px-2.5 rounded-md border text-[12px] flex items-center gap-1.5"
            style={
              brokenRef
                ? { background: 'var(--warn-soft)', borderColor: 'var(--warn)', color: 'var(--warn)' }
                : { background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent)' }
            }
          >
            {brokenRef ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <Link2 className="h-3 w-3 shrink-0" />}
            <span className="truncate">
              {envVar.export_ref!.export_key} from component {envVar.export_ref!.component}
            </span>
            <button
              type="button"
              onClick={() => onUpdate(index, { name: envVar.name, value: '', export_ref: undefined })}
              className="ml-auto shrink-0 hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <TInput
            placeholder="value"
            value={envVar.value ?? ''}
            onChange={(e) => onUpdate(index, { ...envVar, value: e.target.value })}
            className="font-mono"
          />
        )}
      </div>

      {!isLinked && addonComponents.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportPicker(!showExportPicker)}
            className="h-8 w-8 rounded-md border flex items-center justify-center hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
            title="Use a value exported by another component"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>

          {showExportPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportPicker(false)} />
              <div
                className="absolute right-0 top-9 z-20 w-72 rounded-lg border py-1 max-h-64 overflow-y-auto anim-slide-up"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}
              >
                <p className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                  Use a value exported by a component
                </p>
                {addonComponents.map((comp) => {
                  const def = addonDefinitions.find((d) => d.id === comp.addon?.definitionId);
                  const exports = def?.export_schema;
                  if (!exports || Object.keys(exports).length === 0) return null;
                  return (
                    <div key={comp.id}>
                      <p className="px-3 py-1 text-[11.5px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                        {comp.name} <span style={{ color: 'var(--text-4)' }}>({def?.name})</span>
                      </p>
                      {Object.entries(exports).map(([key, schema]) => (
                        <button
                          key={key}
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-[12px] hover:bg-[var(--surface-2)] flex items-center justify-between"
                          onClick={() => {
                            onUpdate(index, { name: envVar.name || key, export_ref: { component: comp.name, export_key: key } });
                            setShowExportPicker(false);
                          }}
                        >
                          <span className="font-mono" style={{ color: 'var(--text)' }}>{key}</span>
                          <span className="truncate ml-2" style={{ color: 'var(--text-4)' }}>{schema.description}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="h-8 w-8 rounded-md flex items-center justify-center hover:text-[var(--err)] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-4)' }}
        aria-label="Remove env var"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
