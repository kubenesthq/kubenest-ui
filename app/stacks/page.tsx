'use client';

/**
 * /stacks — the app-template gallery (kn-a7d).
 *
 * Two tabs:
 *   - "My templates" — org-scoped, from `GET /stack-templates`. Each card has
 *     Deploy (jumps to /stacks/deploy?ns=&name=) and Delete (with confirm).
 *   - "Community" — registry templates from `GET /stack-templates/registry`.
 *     Each card has Install, which POSTs and refreshes the My tab on success.
 *
 * Search filters by name/description; tag chips filter by tag. The empty
 * state nudges the user toward the create-app flow or installing a community
 * template, so the page is useful on a fresh org with zero templates seeded.
 *
 * Visual style matches /stacks/deploy and the app-detail page (design tokens,
 * Btn/Card/Pill from components/shell/primitives) — deliberately NOT the
 * shadcn-flavoured `/settings/stack-templates` admin page, which is a
 * different surface.
 */
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Database,
  Download,
  Globe,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import {
  useDeleteStackTemplate,
  useInstallRegistryTemplate,
  useRegistryTemplates,
  useStackTemplates,
} from '@/hooks/useStackTemplates';
import { ApiClientError } from '@/lib/api-client';
import { Btn, Card, Pill, SectionLabel } from '@/components/shell/primitives';
import type {
  RegistryTemplateSummary,
  StackTemplateRead,
} from '@/lib/api/stack-templates';

type TabId = 'my' | 'community';

export default function StacksGalleryPage() {
  return (
    <Suspense fallback={<GallerySkeleton />}>
      <StacksGalleryInner />
    </Suspense>
  );
}

function StacksGalleryInner() {
  const { isAuthenticated } = useAuth(true);
  const { toast } = useToast();

  const [tab, setTab] = useState<TabId>('my');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StackTemplateRead | null>(null);

  const myTemplates = useStackTemplates();
  const registryTemplates = useRegistryTemplates();
  const installRegistry = useInstallRegistryTemplate();
  const deleteTemplate = useDeleteStackTemplate();

  // Stabilise the derived arrays so the dependent useMemos below don't
  // re-fire on every render of the parent.
  const myList = useMemo(() => myTemplates.data?.data ?? [], [myTemplates.data]);
  const communityList = useMemo(() => registryTemplates.data?.data ?? [], [registryTemplates.data]);

  // Aggregate the tag universe from whichever tab is active so the chip row
  // doesn't include irrelevant tags.
  const allTagsForTab = useMemo(() => {
    const source = tab === 'my' ? myList : communityList;
    const set = new Set<string>();
    for (const t of source) {
      for (const tag of t.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort();
  }, [tab, myList, communityList]);

  const filteredMy = useMemo(
    () => applyFilters(myList, search, activeTag),
    [myList, search, activeTag],
  );
  const filteredCommunity = useMemo(
    () => applyFilters(communityList, search, activeTag),
    [communityList, search, activeTag],
  );

  // Don't show the gallery body until auth has bounced unauthenticated
  // users to /login (useAuth handles that redirect).
  if (!isAuthenticated) return <GallerySkeleton />;

  const handleInstall = (template: RegistryTemplateSummary) => {
    installRegistry.mutate(
      { name: template.name, namespace: 'default' },
      {
        onSuccess: () => {
          toast({
            title: 'Template installed',
            description: `${template.name} is now in your My templates tab.`,
          });
          setTab('my');
        },
        onError: (error: Error) => {
          toast({
            title: 'Install failed',
            description: errorMessage(error),
            variant: 'error',
          });
        },
      },
    );
  };

  const handleDelete = (template: StackTemplateRead) => {
    deleteTemplate.mutate(
      { namespace: template.namespace, name: template.name },
      {
        onSuccess: () => {
          toast({
            title: 'Template deleted',
            description: `${template.name} has been removed.`,
          });
          setDeleteTarget(null);
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

  const activeQuery = tab === 'my' ? myTemplates : registryTemplates;
  const activeList = tab === 'my' ? filteredMy : filteredCommunity;
  const sourceCount = tab === 'my' ? myList.length : communityList.length;
  const showFilterEmpty =
    !activeQuery.isLoading
    && !activeQuery.isError
    && activeList.length === 0
    && sourceCount > 0;

  return (
    <div className="px-6 py-5 max-w-[1280px] mx-auto">
      <Link
        href="/apps"
        className="inline-flex items-center gap-1.5 text-[12.5px] mb-4 hover:text-[var(--text)]"
        style={{ color: 'var(--text-3)' }}
      >
        <ArrowLeft size={13} /> Apps
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Layers className="h-5 w-5" style={{ color: 'var(--accent)' }} /> App templates
          </h1>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-3)' }}>
            Pre-built stacks you can deploy in one click — your org&apos;s saved templates and the public registry.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Btn
            variant="default"
            size="sm"
            icon={RefreshCw}
            onClick={() => (tab === 'my' ? myTemplates.refetch() : registryTemplates.refetch())}
            disabled={activeQuery.isFetching}
          >
            Refresh
          </Btn>
          <Link href="/apps/new" className="inline-flex">
            <Btn variant="primary" size="sm" icon={Plus}>New app from scratch</Btn>
          </Link>
        </div>
      </div>

      <div role="tablist" style={{ borderBottom: '1px solid var(--border)' }} className="flex items-center gap-1 mb-4">
        <TabButton id="my" active={tab === 'my'} onClick={() => setTab('my')} count={myList.length}>
          My templates
        </TabButton>
        <TabButton id="community" active={tab === 'community'} onClick={() => setTab('community')} count={communityList.length}>
          Community
        </TabButton>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: 'var(--text-4)' }}
          />
          <input
            type="search"
            placeholder="Search by name or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="stacks-search"
            className="h-8 w-full rounded-md border pl-7 pr-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
        {allTagsForTab.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <SectionLabel className="!mb-0 mr-1">Tags</SectionLabel>
            {activeTag && (
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px]"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}
                data-testid="stacks-tag-clear"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            {allTagsForTab.map((tag) => {
              const on = tag === activeTag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(on ? null : tag)}
                  data-testid={`stacks-tag-${tag}`}
                  className="inline-flex items-center h-6 px-2 rounded-md text-[11px] transition-colors hover:opacity-90"
                  style={{
                    background: on ? 'var(--accent)' : 'var(--surface-2)',
                    color: on ? 'var(--on-accent)' : 'var(--text-2)',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activeQuery.isLoading && <GalleryGridSkeleton />}

      {activeQuery.isError && (
        <ErrorBanner
          message={errorMessage(activeQuery.error)}
          onRetry={() => activeQuery.refetch()}
        />
      )}

      {!activeQuery.isLoading && !activeQuery.isError && tab === 'my' && (
        myList.length === 0 ? (
          <MyTemplatesEmptyState onBrowseCommunity={() => setTab('community')} />
        ) : showFilterEmpty ? (
          <FilterEmptyState onClear={() => { setSearch(''); setActiveTag(null); }} />
        ) : (
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="stacks-my-grid"
          >
            {filteredMy.map((template) => (
              <MyTemplateCard
                key={`${template.namespace}/${template.name}`}
                template={template}
                onDelete={() => setDeleteTarget(template)}
              />
            ))}
          </div>
        )
      )}

      {!activeQuery.isLoading && !activeQuery.isError && tab === 'community' && (
        communityList.length === 0 ? (
          <CommunityEmptyState />
        ) : showFilterEmpty ? (
          <FilterEmptyState onClear={() => { setSearch(''); setActiveTag(null); }} />
        ) : (
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="stacks-community-grid"
          >
            {filteredCommunity.map((template) => (
              <CommunityTemplateCard
                key={template.name}
                template={template}
                installing={installRegistry.isPending && installRegistry.variables?.name === template.name}
                onInstall={() => handleInstall(template)}
              />
            ))}
          </div>
        )
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          template={deleteTarget}
          pending={deleteTemplate.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function applyFilters<T extends { name: string; description?: string | null; tags?: string[] | null }>(
  list: T[],
  search: string,
  tag: string | null,
): T[] {
  const term = search.trim().toLowerCase();
  return list.filter((t) => {
    if (term) {
      const haystack = `${t.name} ${t.description ?? ''}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (tag && !(t.tags ?? []).includes(tag)) return false;
    return true;
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

/* ---------- subcomponents ---------- */

function TabButton({
  id,
  active,
  onClick,
  count,
  children,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={`stacks-tab-${id}`}
      style={{
        color: active ? 'var(--text)' : 'var(--text-3)',
        borderBottomColor: active ? 'var(--accent)' : 'transparent',
      }}
      className="relative h-9 px-3 text-[13px] font-medium border-b-2 -mb-px hover:text-[var(--text)] transition-colors flex items-center gap-1.5"
    >
      {children}
      <span
        className="text-[10.5px] h-4 px-1.5 rounded-full inline-flex items-center"
        style={{
          background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
          color: active ? 'var(--accent)' : 'var(--text-3)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

function MyTemplateCard({
  template,
  onDelete,
}: {
  template: StackTemplateRead;
  onDelete: () => void;
}) {
  const deployHref = `/stacks/deploy?ns=${encodeURIComponent(template.namespace)}&name=${encodeURIComponent(template.name)}`;
  return (
    <Card
      flush
      className="overflow-hidden flex flex-col"
      data-testid={`stacks-my-card-${template.name}`}
    >
      <div className="px-4 py-3 flex items-start gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-base" style={{ background: 'var(--accent-soft)' }}>
          {template.icon ?? '📦'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>{template.name}</p>
          <p className="text-[10.5px] font-mono" style={{ color: 'var(--text-4)' }}>
            {template.namespace} · v{template.version}
          </p>
        </div>
      </div>
      <div className="px-4 py-3 flex-1 space-y-2">
        {template.description ? (
          <p className="text-[12px] line-clamp-2" style={{ color: 'var(--text-3)' }}>{template.description}</p>
        ) : (
          <p className="text-[12px] italic" style={{ color: 'var(--text-4)' }}>No description.</p>
        )}
        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-3)' }}>
          <span>{template.components.length} component{template.components.length === 1 ? '' : 's'}</span>
          {template.scope && <Pill tone="default" size="sm">{template.scope}</Pill>}
        </div>
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="px-1.5 h-5 rounded text-[10.5px] inline-flex items-center"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <Link href={deployHref} className="flex-1">
          <Btn variant="primary" size="sm" className="w-full" data-testid={`stacks-my-deploy-${template.name}`}>
            Deploy
          </Btn>
        </Link>
        <Btn
          variant="ghost"
          size="sm"
          icon={Trash2}
          onClick={onDelete}
          aria-label={`Delete ${template.name}`}
          data-testid={`stacks-my-delete-${template.name}`}
        >
          <span className="sr-only">Delete</span>
        </Btn>
      </div>
    </Card>
  );
}

function CommunityTemplateCard({
  template,
  installing,
  onInstall,
}: {
  template: RegistryTemplateSummary;
  installing: boolean;
  onInstall: () => void;
}) {
  return (
    <Card
      flush
      className="overflow-hidden flex flex-col"
      data-testid={`stacks-community-card-${template.name}`}
    >
      <div className="px-4 py-3 flex items-start gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-base" style={{ background: 'rgba(139,92,246,0.14)' }}>
          {template.icon ?? <Globe className="h-4 w-4" style={{ color: '#8b5cf6' }} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>{template.name}</p>
          <p className="text-[10.5px] font-mono" style={{ color: 'var(--text-4)' }}>v{template.version}</p>
        </div>
      </div>
      <div className="px-4 py-3 flex-1 space-y-2">
        {template.description ? (
          <p className="text-[12px] line-clamp-3" style={{ color: 'var(--text-3)' }}>{template.description}</p>
        ) : (
          <p className="text-[12px] italic" style={{ color: 'var(--text-4)' }}>No description.</p>
        )}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="px-1.5 h-5 rounded text-[10.5px] inline-flex items-center"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <Btn
          variant="primary"
          size="sm"
          icon={Download}
          onClick={onInstall}
          disabled={installing}
          className="w-full"
          data-testid={`stacks-community-install-${template.name}`}
        >
          {installing ? 'Installing…' : 'Install'}
        </Btn>
      </div>
    </Card>
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
        data-testid="stacks-delete-dialog"
      >
        <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>
          Delete template {template.name}?
        </div>
        <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-3)' }}>
          This removes the template from <span className="font-mono">{template.namespace}</span>. Apps already deployed
          from this template are not affected. The template can be re-installed from the community tab if it&apos;s a
          registry template.
        </p>
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Btn>
          <Btn
            variant="danger"
            size="sm"
            onClick={onConfirm}
            disabled={pending}
            data-testid="stacks-delete-confirm"
          >
            {pending ? 'Deleting…' : 'Delete'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function MyTemplatesEmptyState({ onBrowseCommunity }: { onBrowseCommunity: () => void }) {
  return (
    <Card className="text-center py-10" data-testid="stacks-my-empty">
      <Database className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--text-4)' }} />
      <p className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>No templates yet</p>
      <p className="text-[12.5px] mt-1 mb-4 max-w-md mx-auto" style={{ color: 'var(--text-3)' }}>
        Save a running app as a reusable template from its detail page, or install one from the community registry.
      </p>
      <div className="flex items-center justify-center gap-2">
        <Link href="/apps/new" className="inline-flex">
          <Btn variant="default" size="sm" icon={Plus}>Create an app</Btn>
        </Link>
        <Btn variant="primary" size="sm" icon={Globe} onClick={onBrowseCommunity}>
          Browse community
        </Btn>
      </div>
    </Card>
  );
}

function CommunityEmptyState() {
  return (
    <Card className="text-center py-10" data-testid="stacks-community-empty">
      <Globe className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--text-4)' }} />
      <p className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>No community templates available</p>
      <p className="text-[12.5px] mt-1 max-w-md mx-auto" style={{ color: 'var(--text-3)' }}>
        The registry hasn&apos;t returned any templates. Check back later, or configure a custom registry source.
      </p>
    </Card>
  );
}

function FilterEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <Card className="text-center py-10" data-testid="stacks-filter-empty">
      <Search className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--text-4)' }} />
      <p className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>Nothing matches that filter</p>
      <p className="text-[12.5px] mt-1 mb-3" style={{ color: 'var(--text-3)' }}>
        Try a different search term or clear the active tag.
      </p>
      <Btn variant="default" size="sm" onClick={onClear}>Clear filters</Btn>
    </Card>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card
      className="flex items-start gap-3"
      data-testid="stacks-error-banner"
      style={{ borderColor: 'var(--err)', background: 'var(--err-soft)' }}
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--err)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium" style={{ color: 'var(--err)' }}>Failed to load templates</p>
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--err)' }}>{message}</p>
      </div>
      <Btn variant="default" size="sm" icon={RefreshCw} onClick={onRetry}>Retry</Btn>
    </Card>
  );
}

function GallerySkeleton() {
  return (
    <div className="px-6 py-5 max-w-[1280px] mx-auto" data-testid="stacks-skeleton">
      <div className="h-5 w-16 rounded mb-4" style={{ background: 'var(--surface-2)' }} />
      <div className="h-7 w-48 rounded mb-2" style={{ background: 'var(--surface-2)' }} />
      <div className="h-4 w-96 rounded mb-6" style={{ background: 'var(--surface-2)' }} />
      <GalleryGridSkeleton />
    </div>
  );
}

function GalleryGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card flush key={i} className="overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-8 h-8 rounded-md" style={{ background: 'var(--surface-2)' }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 rounded" style={{ background: 'var(--surface-2)' }} />
              <div className="h-2.5 w-20 rounded" style={{ background: 'var(--surface-2)' }} />
            </div>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="h-3 w-full rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 w-4/5 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
          <div className="px-4 py-3 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="h-7 flex-1 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-7 w-9 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
        </Card>
      ))}
    </div>
  );
}
