'use client';

import { Cloud, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useClusters } from '@/hooks/useClusters';
import { useAuth } from '@/hooks/useAuth';
import type { Cluster } from '@/types/api';
import { getConnectionStatus } from '@/types/api';
import { Btn, Card, Pill, StatusDot, statusTone } from '@/components/shell/primitives';

function connLabel(c: Cluster): string {
  switch (getConnectionStatus(c)) {
    case 'connected':
      return 'Connected';
    case 'pending':
      return 'Pending';
    default:
      return 'Disconnected';
  }
}

function ClusterCard({ c }: { c: Cluster }) {
  const tone = statusTone(c.status);
  return (
    <Link href={`/clusters/${c.id}`} className="text-left block">
      <Card flush className="hover:border-[var(--border-strong)] transition-colors h-full">
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusDot status={tone} pulse={tone === 'warn'} />
              <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--text)' }}>{c.name}</span>
            </div>
            <Pill tone={tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : tone === 'err' ? 'err' : 'default'} size="sm" dot>
              {connLabel(c)}
            </Pill>
          </div>
          {c.description && <p className="text-[12px] mb-2" style={{ color: 'var(--text-2)' }}>{c.description}</p>}
          <div className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            {(c.base_domain || c.enterprise_domain) && (
              <>
                <Cloud size={11} /> <span className="truncate">{c.base_domain || c.enterprise_domain}</span>
                <span>·</span>
              </>
            )}
            <span className="font-mono">{c.kubernetes_version || 'k8s ?'}</span>
          </div>
        </div>
        <div className="px-4 py-2.5 flex items-center gap-3 text-[11px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
          <span><span style={{ color: 'var(--text-2)' }} className="font-medium">{c.node_count ?? 0}</span> nodes</span>
          <span>·</span>
          <span>registered {new Date(c.registered_at || c.created_at).toLocaleDateString()}</span>
        </div>
      </Card>
    </Link>
  );
}

export default function ClustersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth(true);
  const { data, isLoading } = useClusters();
  const [q, setQ] = useState('');

  const clusters = useMemo(() => {
    const all = data?.data ?? [];
    const ql = q.trim().toLowerCase();
    return ql ? all.filter((c) => c.name.toLowerCase().includes(ql) || (c.description ?? '').toLowerCase().includes(ql)) : all;
  }, [data, q]);

  if (!isAuthenticated) return null;

  return (
    <div className="px-6 py-5 max-w-[1280px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Clusters</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Kubernetes clusters managed across cloud providers and bare metal</p>
        </div>
        <Btn variant="primary" size="md" icon={Plus} onClick={() => router.push('/clusters/new')}>Register cluster</Btn>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative w-64">
          <Search size={14} style={{ color: 'var(--text-3)' }} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name…"
            className="w-full h-8 rounded-md border pl-8 pr-2.5 text-[13px] focus:outline-none focus:border-[var(--accent)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
        <span className="ml-auto text-[11.5px]" style={{ color: 'var(--text-3)' }}>{clusters.length} cluster{clusters.length === 1 ? '' : 's'}</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} flush className="h-[110px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {clusters.map((c) => <ClusterCard key={c.id} c={c} />)}
          <Link
            href="/clusters/new"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
            className="rounded-[10px] border-2 border-dashed min-h-[110px] flex flex-col items-center justify-center gap-2 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            <Plus size={20} />
            <span className="text-[12.5px] font-medium">Register cluster</span>
          </Link>
        </div>
      )}
      {!isLoading && clusters.length === 0 && q && (
        <p className="mt-4 text-[12.5px]" style={{ color: 'var(--text-3)' }}>No clusters match “{q}”.</p>
      )}
    </div>
  );
}
