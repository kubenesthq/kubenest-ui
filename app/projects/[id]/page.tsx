'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { AddonInstanceList } from '@/components/addons/AddonInstanceList';
import { useApps } from '@/hooks/useApps';
import { getProject, deleteProject, createRegistrySecret, getRegistrySecrets } from '@/api/projects';
import { getCluster } from '@/api/clusters';
import { Btn, Card, Pill, SectionLabel, StatusDot, statusTone } from '@/components/shell/primitives';

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/;

function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', ...(style ?? {}) }}
      className={`h-8 w-full rounded-md border px-2.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] ${className}`}
    />
  );
}

type TabId = 'overview' | 'secrets' | 'rbac' | 'settings';
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Apps & addons' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'rbac', label: 'RBAC' },
  { id: 'settings', label: 'Settings' },
];

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabId>('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRegistryDialog, setShowRegistryDialog] = useState(false);
  const [registryForm, setRegistryForm] = useState({ name: '', server_url: '', username: '', password: '' });
  const [registrySaving, setRegistrySaving] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });

  const { data: cluster } = useQuery({
    queryKey: ['cluster', project?.cluster_id],
    queryFn: () => getCluster(project!.cluster_id),
    enabled: !!project?.cluster_id,
  });

  const { data: registrySecrets } = useQuery({
    queryKey: ['registry-secrets', projectId],
    queryFn: () => getRegistrySecrets(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/projects');
    },
    onError: (error: Error) => {
      setRegistryError(null);
      setShowDeleteDialog(false);
      alert(`Failed to delete project: ${error.message}`);
    },
  });

  const handleRegistrySubmit = async () => {
    setRegistrySaving(true);
    setRegistryError(null);
    try {
      await createRegistrySecret(projectId, registryForm);
      queryClient.invalidateQueries({ queryKey: ['registry-secrets', projectId] });
      setShowRegistryDialog(false);
      setRegistryForm({ name: '', server_url: '', username: '', password: '' });
    } catch (err) {
      setRegistryError(err instanceof Error ? err.message : 'Failed to create registry secret');
    } finally {
      setRegistrySaving(false);
    }
  };

  if (projectLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-3)' }} /></div>;
  }
  if (!project) {
    return (
      <div className="px-6 py-8 max-w-[900px] mx-auto">
        <Card><p className="text-[13px]" style={{ color: 'var(--text-3)' }}>Project not found.</p></Card>
      </div>
    );
  }

  const secrets = registrySecrets ?? [];

  return (
    <div className="px-6 py-5 max-w-[1100px] mx-auto">
      <Link href={cluster ? `/clusters/${cluster.id}` : '/projects'} className="inline-flex items-center gap-1.5 text-[12.5px] mb-4 hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>
        <ArrowLeft size={13} /> {cluster ? cluster.name : 'Projects'}
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-semibold tracking-tight truncate" style={{ color: 'var(--text)' }}>{project.name}</h1>
            <Pill tone={statusTone(project.status) === 'ok' ? 'ok' : statusTone(project.status) === 'warn' ? 'warn' : statusTone(project.status) === 'err' ? 'err' : 'default'} size="sm" dot>{project.status}</Pill>
          </div>
          <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            namespace <span className="font-mono">{project.namespace}</span>
            {project.created_at ? <> · created {format(new Date(project.created_at), 'MMM d, yyyy')}</> : null}
            {cluster ? <> · <Link href={`/clusters/${cluster.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{cluster.name}</Link></> : null}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Btn variant="default" size="sm" icon={KeyRound} onClick={() => setShowRegistryDialog(true)}>Add registry secret</Btn>
          <Btn variant="primary" size="sm" icon={Plus} onClick={() => router.push(`/apps/new?project_id=${project.id}`)}>Create app</Btn>
        </div>
      </div>

      <div role="tablist" style={{ borderBottom: '1px solid var(--border)' }} className="flex items-center gap-1 mb-4">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{ color: active ? 'var(--text)' : 'var(--text-3)', borderBottomColor: active ? 'var(--accent)' : 'transparent' }}
              className="relative h-9 px-3 text-[13px] font-medium border-b-2 -mb-px hover:text-[var(--text)] transition-colors"
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <Card flush>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Apps</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Apps running in this project</div>
              </div>
              <Btn variant="default" size="sm" icon={Plus} onClick={() => router.push(`/apps/new?project_id=${project.id}`)}>Create</Btn>
            </div>
            <div className="p-3"><ProjectAppsList projectId={project.id} /></div>
          </Card>

          <Card flush>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Addons</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Managed backing services — databases, queues, caches</div>
              </div>
              <Btn variant="default" size="sm" icon={Plus} onClick={() => router.push(`/projects/${project.id}/addons/new`)}>Add addon</Btn>
            </div>
            <div className="p-3"><AddonInstanceList projectId={project.id} /></div>
          </Card>
        </div>
      )}

      {tab === 'secrets' && (
        <div className="space-y-4">
          <Card flush>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Registry pull secrets</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Container-registry credentials available to every app in this project</div>
              </div>
              <Btn variant="default" size="sm" icon={KeyRound} onClick={() => setShowRegistryDialog(true)}>Add</Btn>
            </div>
            <div className="p-3">
              {secrets.length === 0 ? (
                <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>No registry secrets yet.</p>
              ) : (
                <div className="space-y-1">
                  {secrets.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-md px-3 py-2" style={{ border: '1px solid var(--border)' }}>
                      <KeyRound className="h-4 w-4 shrink-0" style={{ color: 'var(--text-3)' }} />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{s.name}</p>
                        <p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{s.server_url} · {s.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }} className="text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5">Not yet available</span>
              <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Per-app secret rollup</span>
            </div>
            <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              A consolidated view of every component secret across this project’s apps lands once the project-secrets API ships — not yet available, needs kn-B14.
            </p>
          </Card>
        </div>
      )}

      {tab === 'rbac' && (
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            <span style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }} className="text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5">Not yet available</span>
            <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Project RBAC</span>
          </div>
          <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            Per-project role assignments (who can deploy, who can view) are intentionally stubbed and labelled — not yet available, needs kn-B15. Cluster- and org-level membership lives under Workspace → Members today.
          </p>
        </Card>
      )}

      {tab === 'settings' && (
        <Card>
          <SectionLabel className="mb-2.5">Project settings</SectionLabel>
          <div className="grid gap-2 text-[12px] md:grid-cols-2 mb-4">
            {([
              ['Name', project.name],
              ['Namespace', project.namespace],
              ['Cluster', cluster?.name ?? project.cluster_id],
              ['Created', project.created_at ? format(new Date(project.created_at), 'MMM d, yyyy') : '—'],
            ] as const).map(([k, v]) => (
              <div key={k}><span style={{ color: 'var(--text-3)' }}>{k}: </span><span style={{ color: 'var(--text)' }}>{v}</span></div>
            ))}
          </div>
          <div className="rounded-lg p-3" style={{ border: '1px solid var(--err-soft)', background: 'var(--err-soft)' }}>
            <p className="text-[12.5px] font-medium" style={{ color: 'var(--err)' }}>Delete this project</p>
            <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: 'var(--err)' }}>Removes the namespace and everything in it. This cannot be undone.</p>
            <Btn variant="danger" size="sm" onClick={() => setShowDeleteDialog(true)}>Delete project</Btn>
          </div>
        </Card>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowDeleteDialog(false)}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-xl border anim-slide-up p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)', width: 480 }} role="dialog" aria-label="Delete project">
            <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Delete project</div>
            <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-3)' }}>
              Delete <span className="font-medium" style={{ color: 'var(--text-2)' }}>{project.name}</span>? This deletes the namespace <span className="font-mono">{project.namespace}</span> and all resources within it. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setShowDeleteDialog(false)} disabled={deleteMutation.isPending}>Cancel</Btn>
              <Btn variant="danger" size="sm" onClick={() => deleteMutation.mutate(projectId)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Deleting…' : 'Delete project'}</Btn>
            </div>
          </div>
        </div>
      )}

      {showRegistryDialog && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowRegistryDialog(false)}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-xl border anim-slide-up p-4 w-full max-w-md mx-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }} role="dialog" aria-label="Add registry secret">
            <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Add a registry pull secret</div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>Credentials for pulling private images. Available to every app in <span className="font-medium" style={{ color: 'var(--text-2)' }}>{project.name}</span>.</p>
            <div className="space-y-3">
              {registryError && <p className="text-[12px] rounded px-3 py-2" style={{ background: 'var(--err-soft)', color: 'var(--err)' }}>{registryError}</p>}
              <div>
                <label htmlFor="reg-name" className="text-[11.5px] font-medium block mb-1" style={{ color: 'var(--text-3)' }}>Secret name</label>
                <TInput id="reg-name" placeholder="docker-hub" value={registryForm.name} onChange={(e) => setRegistryForm({ ...registryForm, name: e.target.value })} />
                {registryForm.name && !K8S_NAME_RE.test(registryForm.name) && <p className="text-[11px] mt-1" style={{ color: 'var(--err)' }}>Lowercase letters, numbers, hyphens, and dots only. Must start and end alphanumeric.</p>}
              </div>
              <div>
                <label htmlFor="reg-url" className="text-[11.5px] font-medium block mb-1" style={{ color: 'var(--text-3)' }}>Registry URL</label>
                <TInput id="reg-url" placeholder="https://index.docker.io/v1/" value={registryForm.server_url} onChange={(e) => setRegistryForm({ ...registryForm, server_url: e.target.value })} />
              </div>
              <div>
                <label htmlFor="reg-user" className="text-[11.5px] font-medium block mb-1" style={{ color: 'var(--text-3)' }}>Username</label>
                <TInput id="reg-user" placeholder="Registry username" value={registryForm.username} onChange={(e) => setRegistryForm({ ...registryForm, username: e.target.value })} />
              </div>
              <div>
                <label htmlFor="reg-pass" className="text-[11.5px] font-medium block mb-1" style={{ color: 'var(--text-3)' }}>Password / token</label>
                <TInput id="reg-pass" type="password" placeholder="Registry password or token" value={registryForm.password} onChange={(e) => setRegistryForm({ ...registryForm, password: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Btn variant="ghost" size="sm" onClick={() => setShowRegistryDialog(false)} disabled={registrySaving}>Cancel</Btn>
              <Btn
                variant="primary"
                size="sm"
                onClick={handleRegistrySubmit}
                disabled={registrySaving || !registryForm.name || !K8S_NAME_RE.test(registryForm.name) || !registryForm.server_url || !registryForm.username || !registryForm.password}
              >
                {registrySaving ? 'Adding…' : 'Add secret'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectAppsList({ projectId }: { projectId: string }) {
  const router = useRouter();
  const appsQuery = useApps({ project_id: projectId });

  if (appsQuery.isLoading) return <div className="py-4 text-[12.5px]" style={{ color: 'var(--text-3)' }}>Loading apps…</div>;
  if (appsQuery.isError) return <div className="py-4 text-[12.5px]" style={{ color: 'var(--text-3)' }}>Apps unavailable for this project.</div>;
  const apps = appsQuery.data?.data ?? [];
  if (apps.length === 0) return <div className="py-4 text-[12.5px]" style={{ color: 'var(--text-3)' }}>No apps deployed in this project yet.</div>;

  return (
    <div className="space-y-1">
      {apps.map((a) => (
        <button
          key={`${a.namespace}/${a.name}`}
          type="button"
          onClick={() => router.push(`/apps/${a.namespace}/${a.name}?project_id=${projectId}`)}
          className="w-full flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-[var(--surface-2)] transition-colors"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
            <p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{a.component_count} component{a.component_count === 1 ? '' : 's'}{a.template_id ? ' · via template' : ''}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusDot status={statusTone(a.phase)} pulse={statusTone(a.phase) === 'warn'} />
            <span className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>{a.phase}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
