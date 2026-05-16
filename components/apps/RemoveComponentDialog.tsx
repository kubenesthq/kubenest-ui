'use client';

/**
 * Confirmation dialog for removing a component from a running app (kn-fxe).
 *
 * Two failure modes the user needs to see before pressing Remove:
 *
 *   1. The backend will 422 if some other component in this app has an
 *      env-var `export_ref` pointing at the one being removed — preview that
 *      client-side so the user can fix the references first instead of
 *      bouncing off the server-side guard.
 *   2. The action is destructive and can't be undone — surface the right
 *      wording for workload vs addon so the user knows whether they're
 *      tearing down a container or a managed service.
 *
 * The submit promise is owned by the caller (so this dialog stays generic
 * about which mutation hook is firing) — we just stay open until `onConfirm`
 * resolves or rejects, and surface the error inline.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Btn } from '@/components/shell/primitives';
import { ApiClientError } from '@/lib/api-client';
import { extractExportRef } from './AttachAddonDrawer';
import type { AppReadComponent } from '@/types/api';

export interface ExportRefRef {
  workloadName: string;
  envVarName: string;
  exportKey: string;
}

/**
 * Scan every other component's env vars for `export_ref.component === target`.
 * If the backend isn't returning workload_spec yet (older deploy), we get
 * back an empty array — the server-side guard still catches it on submit.
 */
export function findExportRefDependencies(
  components: AppReadComponent[],
  targetName: string,
): ExportRefRef[] {
  const refs: ExportRefRef[] = [];
  for (const component of components) {
    if (component.name === targetName) continue;
    const spec = component.workload_spec ?? null;
    if (!spec || typeof spec !== 'object') continue;
    const env = (spec as Record<string, unknown>).env;
    if (!Array.isArray(env)) continue;
    for (const entry of env) {
      if (!entry || typeof entry !== 'object') continue;
      const envObj = entry as Record<string, unknown>;
      const ref = extractExportRef(envObj);
      if (ref && ref.component === targetName) {
        refs.push({
          workloadName: component.name,
          envVarName: typeof envObj.name === 'string' ? envObj.name : '(unnamed)',
          exportKey: ref.exportKey,
        });
      }
    }
  }
  return refs;
}

function removeErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const detail = error.detail as Record<string, unknown> | null;
    if (error.status === 422) {
      const code = detail && typeof detail.code === 'string' ? detail.code : undefined;
      if (code === 'export_ref_broken') {
        return 'Cannot remove — other components still reference exports from this one. Remove those env vars first.';
      }
      const detailMessage = detail && typeof detail.message === 'string' ? detail.message : undefined;
      return detailMessage ?? 'Component cannot be removed in this configuration.';
    }
    const detailMessage = detail && typeof detail.message === 'string' ? detail.message : undefined;
    return detailMessage ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to remove component';
}

export function RemoveComponentDialog({
  open,
  componentName,
  componentType,
  allComponents,
  onClose,
  onConfirm,
}: {
  open: boolean;
  componentName: string | null;
  componentType: 'workload' | 'addon' | null;
  allComponents: AppReadComponent[];
  onClose: () => void;
  /** Resolves on success — the dialog closes only after the resolve. */
  onConfirm: (name: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dependencies = useMemo(
    () => (componentName ? findExportRefDependencies(allComponents, componentName) : []),
    [allComponents, componentName],
  );

  if (!open || !componentName) return null;

  const isLastComponent = allComponents.length <= 1;
  const hasDependencies = dependencies.length > 0;
  const isAddon = componentType === 'addon';
  const noun = isAddon ? 'managed service' : 'workload';

  const close = () => {
    setError(null);
    setPending(false);
    onClose();
  };

  const submit = async () => {
    setError(null);
    setPending(true);
    try {
      await onConfirm(componentName);
      close();
    } catch (err) {
      setError(removeErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  // Block confirmation when client-side guard or server-equivalent guard would fail.
  const confirmDisabled = pending || hasDependencies || isLastComponent;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 520 }}
        className="rounded-xl border anim-slide-up p-4"
        role="dialog"
        aria-label={`Remove ${componentName}`}
        data-testid="remove-component-dialog"
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--err-soft)' }}>
            <Trash2 className="h-4 w-4" style={{ color: 'var(--err)' }} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
              Remove {componentName}?
            </h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
              This permanently deletes the {noun} <span className="font-medium" style={{ color: 'var(--text-2)' }}>{componentName}</span> and all its Kubernetes resources from this app. This cannot be undone.
            </p>
          </div>
        </div>

        {isLastComponent && (
          <div
            className="rounded-md px-3 py-2 mb-3 flex items-start gap-2 text-[12px]"
            style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
            data-testid="remove-component-last-warning"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              An app must keep at least one component. To get rid of {componentName}, add a replacement component first, then come back to remove this one — or delete the app entirely.
            </span>
          </div>
        )}

        {hasDependencies && (
          <div
            className="rounded-md px-3 py-2 mb-3 space-y-1.5 text-[12px]"
            style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
            data-testid="remove-component-dependency-warning"
          >
            <div className="flex items-start gap-2 font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {dependencies.length} env var{dependencies.length === 1 ? '' : 's'} in other components reference exports from {componentName}:
              </span>
            </div>
            <ul className="pl-5 list-disc space-y-0.5 font-mono text-[11px]">
              {dependencies.map((dep) => (
                <li key={`${dep.workloadName}-${dep.envVarName}-${dep.exportKey}`}>
                  {dep.workloadName}: {dep.envVarName} (from {dep.exportKey})
                </li>
              ))}
            </ul>
            <p className="font-medium pl-5">Remove these references first, then retry.</p>
          </div>
        )}

        {error && (
          <div
            className="rounded-md px-3 py-2 mb-3 flex items-start gap-2 text-[12px]"
            style={{ background: 'var(--err-soft)', color: 'var(--err)' }}
            data-testid="remove-component-error"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={close} disabled={pending}>
            {confirmDisabled && !pending ? 'Close' : 'Cancel'}
          </Btn>
          {!isLastComponent && !hasDependencies && (
            <Btn
              variant="danger"
              size="sm"
              onClick={submit}
              disabled={pending}
              data-testid="remove-component-confirm"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Removing…
                </>
              ) : (
                'Remove'
              )}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
