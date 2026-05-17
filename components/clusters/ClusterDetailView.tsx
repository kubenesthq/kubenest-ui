'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Check,
  Compass,
  Copy,
  FolderKanban,
  Loader2,
  Plus,
  Settings as SettingsIcon,
  Shield,
  Terminal,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ComponentType } from 'react';
import { getClusterConfig } from '@/api/clusters';
import { clustersApi } from '@/lib/api/clusters';
import { useCluster, useClusterProjects, useDeleteCluster } from '@/hooks/useClusters';
import type { Cluster } from '@/types/api';
import { getConnectionStatus } from '@/types/api';
import { Btn, Card, Pill, SectionLabel, StatusDot, statusTone } from '@/components/shell/primitives';
import { ClusterMetrics } from '@/components/metrics/Metrics';
import { ClusterScaleCard } from './ClusterScaleCard';
import { ProvisioningJobsPanel } from './ProvisioningJobsPanel';

type IconType = ComponentType<{ size?: number }>;
type TabId = 'overview' | 'projects' | 'provisioning' | 'rbac' | 'settings';

function connInfo(c: Cluster) {
  const s = getConnectionStatus(c);
  if (s === 'connected') return { tone: 'ok' as const, label: 'Connected' };
  if (s === 'pending') return { tone: 'warn' as const, label: 'Pending' };
  return { tone: 'err' as const, label: 'Disconnected' };
}

// ── stubs (Tier-3, labelled) ────────────────────────────────────────────────
function StubCard({ title, body, bead }: { title: string; body: string; bead: string }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }} className="text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5">Not yet available</span>
        <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{title}</span>
      </div>
      <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>{body}</p>
      <p className="text-[11px] mt-1.5 font-mono" style={{ color: 'var(--text-4)' }}>tracked by {bead}</p>
    </Card>
  );
}

function InstallInstructions({ clusterId }: { clusterId: string }) {
  const q = useQuery({
    queryKey: ['cluster-install-command', clusterId],
    queryFn: () => clustersApi.getInstallCommand(clusterId),
  });
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!q.data?.command) return;
    try {
      await navigator.clipboard.writeText(q.data.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };
  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <Terminal size={14} style={{ color: 'var(--text-3)' }} />
        <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Connect the operator</span>
      </div>
      <p className="text-[12px] mb-2.5" style={{ color: 'var(--text-3)' }}>
        Run this in the target cluster (with <span className="font-mono">kubectl</span> access). The operator connects back to KubeNest over a websocket — the cluster shows <span className="font-medium" style={{ color: 'var(--text-2)' }}>Connected</span> once it&apos;s up.
      </p>
      {q.isLoading ? (
        <div className="rounded-md p-3 flex items-center gap-2 text-[12px]" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
          <Loader2 size={13} className="animate-spin" /> Fetching install command…
        </div>
      ) : q.data?.command ? (
        <div className="relative">
          <pre
            className="rounded-md p-3 pr-10 text-[11.5px] font-mono whitespace-pre-wrap break-all"
            style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
          >
            {q.data.command}
          </pre>
          <button onClick={copy} title="Copy" className="absolute right-2 top-2 h-6 w-6 rounded inline-flex items-center justify-center hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-3)' }}>
            {copied ? <Check size={13} style={{ color: 'var(--ok)' }} /> : <Copy size={13} />}
          </button>
        </div>
      ) : (
        <div className="rounded-md p-3 text-[12px]" style={{ background: 'var(--err-soft)', color: 'var(--err)' }}>
          Couldn&apos;t fetch the install command{q.error instanceof Error ? `: ${q.error.message}` : ''}.
        </div>
      )}
    </Card>
  );
}

function ComponentsConfigCard({ clusterId }: { clusterId: string }) {
  const q = useQuery({ queryKey: ['cluster-config', clusterId], queryFn: () => getClusterConfig(clusterId) });
  const cfg = q.data;
  const items: { label: string; on: boolean; detail?: string }[] = cfg
    ? [
        { label: 'Storage (Longhorn)', on: !!cfg.storage },
        { label: 'High availability', on: !!cfg.ha },
        { label: 'Image builds', on: !!cfg.build },
        { label: 'Monitoring', on: !!cfg.monitoring?.enabled, detail: cfg.monitoring?.provider ?? undefined },
      ]
    : [];
  const anyOn = items.some((i) => i.on);
  return (
    <Card>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Platform components</span>
        <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>first-run config</span>
      </div>
      {q.isLoading ? (
        <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Loading…</div>
      ) : !anyOn ? (
        <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>No platform components enabled on this cluster.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.filter((i) => i.on).map((i) => (
            <Pill key={i.label} tone="accent" size="sm">{i.label}{i.detail ? ` · ${i.detail}` : ''}</Pill>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── tabs ────────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, projectCount }: { tab: TabId; setTab: (t: TabId) => void; projectCount?: number }) {
  const tabs: { id: TabId; label: string; icon: IconType; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'projects', label: 'Projects', icon: FolderKanban, count: projectCount },
    { id: 'provisioning', label: 'Provisioning', icon: Activity },
    { id: 'rbac', label: 'RBAC', icon: Shield },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];
  return (
    <div role="tablist" style={{ borderBottom: '1px solid var(--border)' }} className="flex items-center gap-1 mb-4">
      {tabs.map((t) => {
        const active = tab === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            aria-label={t.label}
            onClick={() => setTab(t.id)}
            style={{ color: active ? 'var(--text)' : 'var(--text-3)', borderBottomColor: active ? 'var(--accent)' : 'transparent' }}
            className="relative h-9 px-3 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 hover:text-[var(--text)] transition-colors"
          >
            <Icon size={13} />
            {t.label}
            {t.count != null && (
              <span style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }} className="ml-0.5 text-[10.5px] font-medium rounded px-1.5 py-0.5">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function OverviewTab({ cluster }: { cluster: Cluster }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="col-span-3">
        <SectionLabel className="mb-2">Status</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Connection</div>
            <div className="mt-1"><Pill tone={connInfo(cluster).tone} dot>{connInfo(cluster).label}</Pill></div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Health</div>
            <div className="mt-1 text-[13px] font-medium capitalize" style={{ color: 'var(--text)' }}>{cluster.status}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Nodes</div>
            <div className="mt-1 text-[13px] font-medium" style={{ color: 'var(--text)' }}>{cluster.node_count ?? 0}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Kubernetes</div>
            <div className="mt-1 text-[13px] font-mono" style={{ color: 'var(--text)' }}>{cluster.kubernetes_version || 'unknown'}</div>
          </div>
          {cluster.last_heartbeat && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Last heartbeat</div>
              <div className="mt-1 text-[12.5px]" style={{ color: 'var(--text-2)' }}>{new Date(cluster.last_heartbeat).toLocaleString()}</div>
            </div>
          )}
          {(cluster.base_domain || cluster.enterprise_domain) && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Ingress domain</div>
              <div className="mt-1 text-[12.5px] font-mono" style={{ color: 'var(--text-2)' }}>{cluster.base_domain || cluster.enterprise_domain}</div>
            </div>
          )}
        </div>
      </Card>

      <div className="col-span-2 space-y-4">
        {getConnectionStatus(cluster) !== 'connected' && <InstallInstructions clusterId={cluster.id} />}
        <Card><ClusterMetrics clusterId={cluster.id} /></Card>
      </div>
      <div className="space-y-4">
        <ComponentsConfigCard clusterId={cluster.id} />
        <ClusterScaleCard cluster={cluster} />
      </div>
    </div>
  );
}

function ProjectsTab({ cluster }: { cluster: Cluster }) {
  const q = useClusterProjects(cluster.id);
  const projects = q.data?.data ?? [];
  return (
    <Card flush>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Projects in this cluster</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Namespaces and the apps/add-ons running in them</div>
        </div>
        <Link href={`/clusters/${cluster.id}/projects/new`}>
          <Btn variant="primary" size="sm" icon={Plus}>New project</Btn>
        </Link>
      </div>
      {q.isLoading ? (
        <div className="py-8 flex items-center justify-center"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
      ) : projects.length === 0 ? (
        <div className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>No projects yet — create one to deploy apps.</div>
      ) : (
        <div>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="grid grid-cols-12 items-center px-4 py-3 hover:bg-[var(--surface-2)] transition-colors text-left"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                <StatusDot status={statusTone(p.status)} pulse={statusTone(p.status) === 'warn'} />
                <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.display_name || p.name}</span>
              </div>
              <div className="col-span-4 text-[12px] font-mono truncate" style={{ color: 'var(--text-3)' }}>{p.namespace}</div>
              <div className="col-span-3 text-right text-[11.5px] capitalize" style={{ color: 'var(--text-3)' }}>{p.status}</div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function SettingsTab({ cluster }: { cluster: Cluster }) {
  const router = useRouter();
  const del = useDeleteCluster();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="col-span-2">
        <SectionLabel className="mb-2.5">General</SectionLabel>
        {([
          ['Cluster name', cluster.name],
          ['Description', cluster.description || '—'],
          ['Status', cluster.status],
          ['Kubernetes version', cluster.kubernetes_version || 'unknown'],
          ['Ingress domain', cluster.base_domain || cluster.enterprise_domain || '—'],
          ['Registered', new Date(cluster.registered_at || cluster.created_at).toLocaleString()],
        ] as const).map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-3 items-center py-1.5">
            <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{k}</div>
            <div className="col-span-2 text-[12.5px]" style={{ color: 'var(--text)' }}>{v}</div>
          </div>
        ))}
      </Card>
      <Card>
        <SectionLabel className="mb-1.5">Danger zone</SectionLabel>
        <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>Deleting this cluster removes its registration from KubeNest. Workloads keep running until cleaned up.</p>
        {!confirm ? (
          <Btn variant="danger" size="sm" icon={Trash2} className="w-full" onClick={() => setConfirm(true)}>Delete cluster</Btn>
        ) : (
          <div className="space-y-2">
            <p className="text-[11.5px]" style={{ color: 'var(--err)' }}>Permanently delete <span className="font-medium">{cluster.name}</span>?</p>
            <div className="flex gap-2">
              <Btn variant="ghost" size="sm" className="flex-1" onClick={() => setConfirm(false)} disabled={del.isPending}>Cancel</Btn>
              <Btn
                variant="danger"
                size="sm"
                className="flex-1"
                disabled={del.isPending}
                onClick={async () => {
                  try {
                    await del.mutateAsync(cluster.id);
                    router.push('/clusters');
                  } catch {
                    /* surfaced by react-query; keep the dialog open */
                  }
                }}
              >
                {del.isPending && <Loader2 size={12} className="animate-spin" />} Delete
              </Btn>
            </div>
            {del.error instanceof Error && <p className="text-[11px]" style={{ color: 'var(--err)' }}>{del.error.message}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

export function ClusterDetailView({ clusterId }: { clusterId: string }) {
  const router = useRouter();
  const { data: cluster, isLoading, error } = useCluster(clusterId);
  const projectsQ = useClusterProjects(clusterId);
  const [tab, setTab] = useState<TabId>('overview');

  if (isLoading) {
    return (
      <div className="px-6 py-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-3)' }} />
      </div>
    );
  }
  if (!cluster) {
    return (
      <div className="px-6 py-8 max-w-[1280px] mx-auto">
        <Card>
          <p className="text-[13px]" style={{ color: 'var(--err)' }}>Failed to load cluster: {error instanceof Error ? error.message : 'not found'}</p>
          <div className="mt-3"><Btn variant="default" size="sm" onClick={() => router.push('/clusters')}>Back to clusters</Btn></div>
        </Card>
      </div>
    );
  }
  const ci = connInfo(cluster);
  return (
    <div className="px-6 py-5 max-w-[1280px] mx-auto">
      {/* Hero */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} className="w-11 h-11 rounded-lg flex items-center justify-center"><Activity size={20} /></div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>{cluster.name}</h1>
              <Pill tone={ci.tone} dot>{ci.label}</Pill>
            </div>
            <div className="text-[12.5px] flex flex-wrap items-center gap-2" style={{ color: 'var(--text-3)' }}>
              <span className="font-mono">{cluster.kubernetes_version || 'k8s ?'}</span>
              <span>·</span>
              <span>{cluster.node_count ?? 0} nodes</span>
              {cluster.description && (<><span>·</span><span>{cluster.description}</span></>)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/clusters/${cluster.id}/projects/new`}>
            <Btn variant="default" size="sm" icon={Plus}>New project</Btn>
          </Link>
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} projectCount={projectsQ.data?.data?.length} />

      {tab === 'overview' && <OverviewTab cluster={cluster} />}
      {tab === 'projects' && <ProjectsTab cluster={cluster} />}
      {tab === 'provisioning' && <ProvisioningJobsPanel clusterId={cluster.id} />}
      {tab === 'rbac' && (
        <StubCard
          title="Role-based access control"
          body="Cluster roles, members, and access bindings will be managed here. RBAC enforcement isn't wired into the platform yet."
          bead="kn-b15 (RBAC endpoints + enforcement)"
        />
      )}
      {tab === 'settings' && <SettingsTab cluster={cluster} />}
    </div>
  );
}
