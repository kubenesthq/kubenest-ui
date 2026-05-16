'use client';

/**
 * Per-component scale dialog (kn-s3n).
 *
 * The backend's `POST /apps/{ns}/{name}/scale` takes a single component
 * name + a target replica count (0-100). We surface the current replica
 * count read from the live component spec as the seed value so the user
 * sees what they're changing from. Setting it to 0 suspends the workload
 * — equivalent to per-component pause.
 */
import { useState } from 'react';
import { AlertCircle, Loader2, Sliders } from 'lucide-react';
import { ApiClientError } from '@/lib/api-client';
import { Btn } from '@/components/shell/primitives';
import { FieldLabel, TInput } from './form-controls';

function scaleErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const detail = error.detail as Record<string, unknown> | null;
    const detailMessage = detail && typeof detail.message === 'string' ? detail.message : undefined;
    return detailMessage ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to scale component';
}

export function ScaleComponentDialog({
  open,
  componentName,
  currentReplicas,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  componentName: string | null;
  currentReplicas: number | null;
  isPending: boolean;
  onClose: () => void;
  /** Caller-owned promise; dialog closes only after it resolves. */
  onSubmit: (replicas: number) => Promise<void>;
}) {
  // Seed text-state from props so the input is controlled with an editable
  // string (cleaner UX than coercing to number on every keystroke). The
  // close() handler resets back to the current count for the next open.
  const [text, setText] = useState<string>(() => String(currentReplicas ?? 1));
  const [error, setError] = useState<string | null>(null);

  if (!open || componentName === null) return null;

  const close = () => {
    setError(null);
    setText(String(currentReplicas ?? 1));
    onClose();
  };

  const submit = async () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) return setError('Replicas is required.');
    const value = Number(trimmed);
    if (!Number.isInteger(value)) return setError('Replicas must be a whole number.');
    if (value < 0 || value > 100) return setError('Replicas must be between 0 and 100.');
    try {
      await onSubmit(value);
      close();
    } catch (err) {
      setError(scaleErrorMessage(err));
    }
  };

  const targetValue = Number(text.trim());
  const isValidNumber = !Number.isNaN(targetValue) && Number.isInteger(targetValue);
  const willSuspend = isValidNumber && targetValue === 0;
  const noChange = isValidNumber && currentReplicas !== null && targetValue === currentReplicas;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => !isPending && close()}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 460 }}
        className="rounded-xl border anim-slide-up p-4"
        role="dialog"
        aria-label={`Scale ${componentName}`}
        data-testid="scale-component-dialog"
      >
        <div className="flex items-start gap-3 mb-3">
          <span
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-soft)' }}
          >
            <Sliders className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
              Scale {componentName}
            </h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
              Currently running{' '}
              <span className="font-medium font-mono" style={{ color: 'var(--text-2)' }}>
                {currentReplicas ?? '—'}
              </span>{' '}
              replica{currentReplicas === 1 ? '' : 's'}. Setting to 0 suspends the workload.
            </p>
          </div>
        </div>

        <div>
          <FieldLabel required>Replicas</FieldLabel>
          <TInput
            type="number"
            min={0}
            max={100}
            step={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="scale-component-input"
          />
          {willSuspend && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--warn)' }}>
              0 replicas will suspend the workload — no pods will run until you scale back up.
            </p>
          )}
        </div>

        {error && (
          <div
            className="rounded-md px-3 py-2 mt-3 flex items-start gap-2 text-[12px]"
            style={{ background: 'var(--err-soft)', color: 'var(--err)' }}
            data-testid="scale-component-error"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="ghost" size="sm" onClick={close} disabled={isPending}>Cancel</Btn>
          <Btn
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={isPending || noChange || !isValidNumber}
            data-testid="scale-component-submit"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Scaling…
              </>
            ) : (
              'Scale'
            )}
          </Btn>
        </div>
      </div>
    </div>
  );
}
