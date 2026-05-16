'use client';

/**
 * Modal for saving a running app as a reusable stack template (kn-ue0).
 *
 * The backend's `POST /apps/{ns}/{name}/template` endpoint takes a
 * {@link StackTemplateFromApp} body and snapshots the live CR into a
 * StackTemplate, automatically stripping `export_ref`s + secrets so the
 * saved template doesn't leak addon-bound values. All this UI has to do
 * is collect a name + a few metadata fields and surface the success/error.
 *
 * Visual style matches the kn-a4l / kn-fxe / kn-gfa dialogs: design
 * tokens + Btn from components/shell/primitives, no shadcn.
 */
import { useState } from 'react';
import { AlertCircle, Layers, Loader2 } from 'lucide-react';
import { ApiClientError } from '@/lib/api-client';
import { Btn } from '@/components/shell/primitives';
import { FieldLabel, TInput, TSelect } from './form-controls';
import type { StackTemplateFromApp } from '@/lib/api/stack-templates';

// Same DNS-label rule as the rest of this app — the backend's
// StackTemplate.name has an identical pattern.
const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;

type Scope = NonNullable<StackTemplateFromApp['scope']>;

interface FormState {
  name: string;
  description: string;
  tagsInput: string;
  version: string;
  scope: Scope;
}

function defaultForm(seedName: string): FormState {
  return {
    name: seedName,
    description: '',
    tagsInput: '',
    version: '1.0.0',
    scope: 'project',
  };
}

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 409) return 'A template with that name already exists in your org.';
    const detail = error.detail as Record<string, unknown> | null;
    const detailMessage = detail && typeof detail.message === 'string' ? detail.message : undefined;
    return detailMessage ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to save template';
}

export function SaveAsTemplateDialog({
  open,
  appName,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Source app name — used to seed a sensible default template name. */
  appName: string;
  isPending: boolean;
  onClose: () => void;
  /** Caller-owned promise; dialog closes only after it resolves. */
  onSubmit: (data: StackTemplateFromApp) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => defaultForm(`${appName}-template`));
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    setError(null);
    setForm(defaultForm(`${appName}-template`));
    onClose();
  };

  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    setError(null);
    const name = form.name.trim();
    if (!name) return setError('Template name is required.');
    if (!k8sNameRegex.test(name)) return setError('Name must be lowercase letters, numbers, and hyphens (DNS label).');
    const version = form.version.trim() || '1.0.0';
    if (!SEMVER_REGEX.test(version)) return setError('Version must be semver, e.g. 1.0.0.');

    const tags = form.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const body: StackTemplateFromApp = {
      name,
      version,
      scope: form.scope,
    };
    const description = form.description.trim();
    if (description) body.description = description;
    if (tags.length > 0) body.tags = tags;

    try {
      await onSubmit(body);
      close();
    } catch (err) {
      setError(submitErrorMessage(err));
    }
  };

  const nameInvalid = form.name.length > 0 && !k8sNameRegex.test(form.name);
  const versionInvalid = form.version.length > 0 && !SEMVER_REGEX.test(form.version);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => !isPending && close()}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 520 }}
        className="rounded-xl border anim-slide-up p-4"
        role="dialog"
        aria-label="Save app as template"
        data-testid="save-as-template-dialog"
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)' }}>
            <Layers className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Save as template</h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
              Snapshot <span className="font-medium" style={{ color: 'var(--text-2)' }}>{appName}</span> as a reusable stack template.
              Addon export-refs and secret values are stripped automatically — only the structural spec is saved.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <FieldLabel required>Template name</FieldLabel>
            <TInput
              placeholder="my-stack"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              data-testid="save-as-template-name"
            />
            {nameInvalid && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--err)' }}>
                Lowercase letters, numbers, and hyphens only.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="w-28">
              <FieldLabel>Version</FieldLabel>
              <TInput
                placeholder="1.0.0"
                value={form.version}
                onChange={(e) => update({ version: e.target.value })}
                data-testid="save-as-template-version"
              />
              {versionInvalid && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--err)' }}>Semver, e.g. 1.0.0.</p>
              )}
            </div>
            <div className="flex-1">
              <FieldLabel>Visibility</FieldLabel>
              <TSelect
                value={form.scope}
                onChange={(e) => update({ scope: e.target.value as Scope })}
                data-testid="save-as-template-scope"
              >
                <option value="project">Project — only this project sees it</option>
                <option value="cluster">Cluster — anyone on the cluster sees it</option>
                <option value="global">Global — visible org-wide</option>
              </TSelect>
            </div>
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={3}
              placeholder="What does this template deploy?"
              className="w-full rounded-md border px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              data-testid="save-as-template-description"
            />
          </div>

          <div>
            <FieldLabel>Tags</FieldLabel>
            <TInput
              placeholder="web, postgres, kn-demo"
              value={form.tagsInput}
              onChange={(e) => update({ tagsInput: e.target.value })}
              data-testid="save-as-template-tags"
            />
            <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-4)' }}>
              Comma-separated. Used by the /stacks gallery&apos;s tag filter chips.
            </p>
          </div>

          {error && (
            <div
              className="rounded-md px-3 py-2 flex items-start gap-2 text-[12px]"
              style={{ background: 'var(--err-soft)', color: 'var(--err)' }}
              data-testid="save-as-template-error"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="ghost" size="sm" onClick={close} disabled={isPending}>Cancel</Btn>
          <Btn
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={isPending}
            data-testid="save-as-template-submit"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </>
            ) : (
              'Save template'
            )}
          </Btn>
        </div>
      </div>
    </div>
  );
}
