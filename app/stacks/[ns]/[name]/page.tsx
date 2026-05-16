'use client';

/**
 * /stacks/[ns]/[name] — template detail page (kn-epw).
 *
 * The middle page between the kn-a7d gallery and the existing
 * /stacks/deploy form. Renders the template's metadata, the components
 * the deploy will provision, and the parameter contract the deploy form
 * will collect — so a user can inspect before deploying.
 *
 * The deploy button just jumps to the deploy page (which already exists
 * and works); the delete button mirrors the gallery's delete dialog.
 */
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Container,
  Database,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import {
  useDeleteStackTemplate,
  useStackTemplate,
} from '@/hooks/useStackTemplates';
import { ApiClientError } from '@/lib/api-client';
import { Btn, Card, Pill, SectionLabel } from '@/components/shell/primitives';
import type {
  ParameterSpec,
  StackTemplateComponent,
  StackTemplateRead,
} from '@/lib/api/stack-templates';

export default function TemplateDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <TemplateDetailInner />
    </Suspense>
  );
}

function TemplateDetailInner() {
  const { isAuthenticated } = useAuth(true);
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const namespace = params.ns as string;
  const name = params.name as string;

  const templateQuery = useStackTemplate(namespace, name);
  const deleteTemplate = useDeleteStackTemplate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!isAuthenticated) return <DetailSkeleton />;
  if (templateQuery.isLoading) return <DetailSkeleton />;

  if (templateQuery.isError) {
    const notFound = templateQuery.error instanceof ApiClientError && templateQuery.error.status === 404;
    return (
      <div className="px-6 py-5 max-w-[1080px] mx-auto">
        <GalleryBackLink />
        <Card className="text-center py-10" data-testid="template-not-found">
          <AlertCircle className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--text-4)' }} />
          <p className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>
            {notFound ? 'Template not found' : 'Failed to load template'}
          </p>
          <p className="text-[12.5px] mt-1 mb-4 max-w-md mx-auto" style={{ color: 'var(--text-3)' }}>
            {notFound
              ? `No template ${name} in ${namespace}. It may have been deleted.`
              : errorMessage(templateQuery.error)}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Btn variant="default" size="sm" onClick={() => templateQuery.refetch()} icon={RefreshCw}>
              Retry
            </Btn>
            <Link href="/stacks" className="inline-flex">
              <Btn variant="primary" size="sm">Back to gallery</Btn>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const template = templateQuery.data!;
  const deployHref = `/stacks/deploy?ns=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}`;

  const handleDelete = () => {
    deleteTemplate.mutate(
      { namespace, name },
      {
        onSuccess: () => {
          toast({
            title: 'Template deleted',
            description: `${name} has been removed.`,
          });
          router.push('/stacks');
        },
        onError: (error: Error) => {
          toast({
            title: 'Delete failed',
            description: errorMessage(error),
            variant: 'error',
          });
        },
      },
    );
  };

  return (
    <div className="px-6 py-5 max-w-[1080px] mx-auto">
      <GalleryBackLink />
      <Header
        template={template}
        deployHref={deployHref}
        onDelete={() => setDeleteOpen(true)}
      />

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <ComponentsCard components={template.components} />
        <ParametersCard parameters={template.parameters} />
      </div>

      {deleteOpen && (
        <DeleteConfirmDialog
          template={template}
          pending={deleteTemplate.isPending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

/* ---------- subcomponents ---------- */

function GalleryBackLink() {
  return (
    <Link
      href="/stacks"
      className="inline-flex items-center gap-1.5 text-[12.5px] mb-4 hover:text-[var(--text)]"
      style={{ color: 'var(--text-3)' }}
    >
      <ArrowLeft size={13} /> Templates
    </Link>
  );
}

function Header({
  template,
  deployHref,
  onDelete,
}: {
  template: StackTemplateRead;
  deployHref: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 text-lg"
            style={{ background: 'var(--accent-soft)' }}
          >
            {template.icon ?? '📦'}
          </span>
          <h1 className="text-[22px] font-semibold tracking-tight truncate" style={{ color: 'var(--text)' }}>
            {template.name}
          </h1>
          <Pill tone="default" size="sm">v{template.version}</Pill>
          {template.scope && <Pill tone="accent" size="sm">{template.scope}</Pill>}
        </div>
        <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
          <span className="font-mono">{template.namespace}</span>
          {template.created_at ? <> · created {new Date(template.created_at).toLocaleDateString()}</> : null}
          {' · '}{template.components.length} component{template.components.length === 1 ? '' : 's'}
        </p>
        {template.description ? (
          <p className="text-[13px] max-w-2xl" style={{ color: 'var(--text-2)' }}>{template.description}</p>
        ) : (
          <p className="text-[12.5px] italic" style={{ color: 'var(--text-4)' }}>No description.</p>
        )}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 h-5 rounded text-[10.5px] inline-flex items-center"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}
                data-testid={`template-detail-tag-${tag}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Link href={deployHref} className="inline-flex">
          <Btn variant="primary" size="sm" icon={Play} data-testid="template-detail-deploy">
            Deploy this template
          </Btn>
        </Link>
        <Btn
          variant="danger"
          size="sm"
          icon={Trash2}
          onClick={onDelete}
          data-testid="template-detail-delete"
        >
          Delete
        </Btn>
      </div>
    </div>
  );
}

function ComponentsCard({ components }: { components: StackTemplateComponent[] }) {
  return (
    <Card flush data-testid="template-detail-components">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <SectionLabel className="!mb-0">Components</SectionLabel>
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
          What this template provisions when deployed.
        </p>
      </div>
      <div className="p-3 space-y-2">
        {components.length === 0 ? (
          <p className="text-[12.5px] italic" style={{ color: 'var(--text-4)' }}>No components.</p>
        ) : (
          components.map((component) => (
            <ComponentRow key={component.name} component={component} />
          ))
        )}
      </div>
    </Card>
  );
}

function ComponentRow({ component }: { component: StackTemplateComponent }) {
  const isWorkload = component.type === 'workload';
  const workloadSpec = component.workloadSpec ?? {};
  const addonSpec = component.addonSpec ?? {};
  const image = typeof workloadSpec.image === 'string' ? workloadSpec.image : null;
  const replicas = typeof workloadSpec.replicas === 'number' ? workloadSpec.replicas : null;
  const port = typeof workloadSpec.port === 'number' ? workloadSpec.port : null;
  const addonType = typeof addonSpec.type === 'string' ? addonSpec.type : null;
  const chart = (addonSpec.chart ?? null) as Record<string, unknown> | null;
  const chartName = chart && typeof chart.name === 'string' ? chart.name : null;
  const chartVersion = chart && typeof chart.version === 'string' ? chart.version : null;

  return (
    <div
      className="rounded-md px-3 py-2.5 space-y-1.5"
      style={{ border: '1px solid var(--border)' }}
      data-testid={`template-detail-component-${component.name}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isWorkload ? (
          <Container size={15} style={{ color: 'var(--accent)' }} />
        ) : (
          <Database size={15} style={{ color: '#8b5cf6' }} />
        )}
        <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{component.name}</p>
        <Pill tone={isWorkload ? 'accent' : 'default'} size="sm">{component.type}</Pill>
      </div>
      <div className="text-[11px] pl-6 space-y-0.5 font-mono" style={{ color: 'var(--text-3)' }}>
        {isWorkload && image && <div>image: {image}</div>}
        {isWorkload && replicas !== null && <div>replicas: {replicas}</div>}
        {isWorkload && port !== null && <div>port: {port}</div>}
        {!isWorkload && addonType && <div>type: {addonType}</div>}
        {!isWorkload && chartName && (
          <div>chart: {chartName}{chartVersion ? `:${chartVersion}` : ''}</div>
        )}
        {component.dependsOn && component.dependsOn.length > 0 && (
          <div>depends on: {component.dependsOn.join(', ')}</div>
        )}
      </div>
    </div>
  );
}

function ParametersCard({ parameters }: { parameters: Record<string, ParameterSpec> | null }) {
  const entries = parameters ? Object.entries(parameters) : [];
  return (
    <Card flush data-testid="template-detail-parameters">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <SectionLabel className="!mb-0">Parameters</SectionLabel>
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
          Values the deploy form will collect from the user.
        </p>
      </div>
      <div className="p-3">
        {entries.length === 0 ? (
          <p className="text-[12.5px] italic" style={{ color: 'var(--text-4)' }}>
            No parameters — deploy is one-click.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map(([key, spec]) => (
              <ParameterRow key={key} paramKey={key} spec={spec} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ParameterRow({ paramKey, spec }: { paramKey: string; spec: ParameterSpec }) {
  const defaultLabel = formatDefaultValue(spec.default);
  return (
    <div
      className="rounded-md px-3 py-2 space-y-1"
      style={{ border: '1px solid var(--border)' }}
      data-testid={`template-detail-parameter-${paramKey}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[12.5px] font-mono font-medium" style={{ color: 'var(--text)' }}>{paramKey}</p>
        <Pill tone="default" size="sm">{spec.type}</Pill>
        {spec.required && <Pill tone="warn" size="sm">required</Pill>}
        {spec.generator && <Pill tone="accent" size="sm">{spec.generator}</Pill>}
      </div>
      {spec.description && (
        <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{spec.description}</p>
      )}
      <p className="text-[10.5px] font-mono" style={{ color: 'var(--text-4)' }}>
        targets: {spec.component} · {spec.path}{defaultLabel !== null ? ` · default: ${defaultLabel}` : ''}
      </p>
    </div>
  );
}

function DeleteConfirmDialog({
  template,
  pending,
  onCancel,
  onConfirm,
}: {
  template: StackTemplateRead;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => !pending && onCancel()}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 480 }}
        className="rounded-xl border anim-slide-up p-4"
        role="dialog"
        aria-label={`Delete template ${template.name}`}
        data-testid="template-detail-delete-dialog"
      >
        <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>
          Delete template {template.name}?
        </div>
        <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-3)' }}>
          This removes the template from <span className="font-mono">{template.namespace}</span>. Apps already
          deployed from this template are unaffected.
        </p>
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Btn>
          <Btn
            variant="danger"
            size="sm"
            onClick={onConfirm}
            disabled={pending}
            data-testid="template-detail-delete-confirm"
          >
            {pending ? 'Deleting…' : 'Delete'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="px-6 py-5 max-w-[1080px] mx-auto" data-testid="template-detail-skeleton">
      <div className="h-5 w-20 rounded mb-4" style={{ background: 'var(--surface-2)' }} />
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-md" style={{ background: 'var(--surface-2)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-48 rounded" style={{ background: 'var(--surface-2)' }} />
          <div className="h-4 w-72 rounded" style={{ background: 'var(--surface-2)' }} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="h-4 w-24 mb-3 rounded" style={{ background: 'var(--surface-2)' }} />
          <div className="space-y-2">
            <div className="h-14 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-14 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
        </Card>
        <Card>
          <div className="h-4 w-24 mb-3 rounded" style={{ background: 'var(--surface-2)' }} />
          <div className="space-y-2">
            <div className="h-12 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

function formatDefaultValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
