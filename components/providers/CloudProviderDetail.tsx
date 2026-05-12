'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Cloud, Loader2, Plus, Server, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getClusters } from '@/api/clusters';
import {
  createCloudCredential,
  deleteCloudCredential,
  getCloudCredentials,
  updateCloudCredential,
} from '@/api/cloud-credentials';
import { getProvisioningJobs } from '@/api/provisioning';
import { useCurrentOrg } from '@/hooks/useOrganization';
import {
  CLOUD_PROVIDERS,
  cloudProviderInfo,
  type Cluster,
  type CloudCredential,
  type CloudCredentialCreate,
  type CloudCredentialUpdate,
  type CloudProvider,
} from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-south-1', 'ap-southeast-1', 'ap-northeast-1',
];

type Tab = 'overview' | 'clusters' | 'credentials' | 'audit';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'clusters', label: 'Clusters' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'audit', label: 'Audit' },
];

function mask(v: string | null | undefined): string {
  return v ? '****' + v.slice(-4) : '—';
}

// ── Create / edit form, provider-shape aware ────────────────────────────────
interface CredFormProps {
  provider: CloudProvider;
  editing: CloudCredential | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (data: CloudCredentialCreate | CloudCredentialUpdate, isEdit: boolean) => void;
}

function CredentialForm({ provider, editing, saving, error, onCancel, onSubmit }: CredFormProps) {
  const isSsh = provider === 'ssh';
  const isEdit = !!editing;
  const [name, setName] = useState(editing?.name ?? '');
  const [region, setRegion] = useState(editing?.region ?? 'us-east-1');
  const [accessKeyId, setAccessKeyId] = useState(editing?.access_key_id ?? '');
  const [secretKey, setSecretKey] = useState('');
  const [user, setUser] = useState(editing?.user ?? '');
  const [hosts, setHosts] = useState((editing?.hosts ?? []).join('\n'));
  const [privateKey, setPrivateKey] = useState('');

  const hostList = hosts.split(/[\n,]/).map((h) => h.trim()).filter(Boolean);
  const valid = isSsh
    ? !!name && !!user && hostList.length > 0 && (isEdit || !!privateKey)
    : !!name && !!region.trim() && !!accessKeyId && (isEdit || !!secretKey);

  const submit = () => {
    if (!valid) return;
    if (isEdit) {
      const u: CloudCredentialUpdate = { name };
      if (isSsh) {
        u.user = user;
        u.hosts = hostList;
        if (privateKey) u.private_key = privateKey;
      } else {
        u.region = region.trim();
        u.access_key_id = accessKeyId;
        if (secretKey) u.secret_access_key = secretKey;
      }
      onSubmit(u, true);
    } else if (isSsh) {
      onSubmit({ name, provider, user, hosts: hostList, private_key: privateKey }, false);
    } else {
      onSubmit({ name, provider, region: region.trim(), access_key_id: accessKeyId, secret_access_key: secretKey }, false);
    }
  };

  return (
    <Card className="border-zinc-200" data-testid="credential-form">
      <CardContent className="pt-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">{isEdit ? 'Edit' : 'Add'} {cloudProviderInfo(provider).label} credential</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-600">Name</Label>
            <Input className="border-zinc-200" placeholder={isSsh ? 'ssh-prod-fleet' : `${provider}-prod`} value={name} data-testid="cred-name" onChange={(e) => setName(e.target.value)} />
          </div>
          {!isSsh && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Region</Label>
                {provider === 'aws' ? (
                  <select className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm bg-white" value={region} onChange={(e) => setRegion(e.target.value)} data-testid="cred-region">
                    {AWS_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <Input className="border-zinc-200" placeholder="region/zone" value={region} data-testid="cred-region" onChange={(e) => setRegion(e.target.value)} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Access key ID</Label>
                <Input className="border-zinc-200 font-mono text-sm" placeholder="AKIA…" value={accessKeyId} data-testid="cred-access-key-id" onChange={(e) => setAccessKeyId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Secret access key{isEdit && <span className="text-zinc-400 font-normal ml-1">(blank = keep current)</span>}</Label>
                <Input type="password" className="border-zinc-200 font-mono text-sm" placeholder={isEdit ? '••••••••' : 'secret'} value={secretKey} data-testid="cred-secret" onChange={(e) => setSecretKey(e.target.value)} />
              </div>
            </>
          )}
          {isSsh && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">SSH user</Label>
                <Input className="border-zinc-200 font-mono text-sm" placeholder="ubuntu" value={user} data-testid="cred-ssh-user" onChange={(e) => setUser(e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium text-zinc-600">Hosts</Label>
                <textarea className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm font-mono min-h-[4.5rem]" placeholder={'10.0.0.10\n10.0.0.11'} value={hosts} data-testid="cred-ssh-hosts" onChange={(e) => setHosts(e.target.value)} />
                <p className="text-[11px] text-zinc-400">One host per line (or comma-separated).</p>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium text-zinc-600">Private key{isEdit && <span className="text-zinc-400 font-normal ml-1">(blank = keep current)</span>}</Label>
                <textarea className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs font-mono min-h-[6rem]" placeholder={isEdit ? '••••••••' : '-----BEGIN OPENSSH PRIVATE KEY-----\n…'} value={privateKey} data-testid="cred-ssh-key" onChange={(e) => setPrivateKey(e.target.value)} />
              </div>
            </>
          )}
        </div>
        {error && <p className="text-xs text-red-700" data-testid="credential-form-error">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={!valid || saving} onClick={submit} data-testid="save-credential">{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{isEdit ? 'Save changes' : 'Save credential'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-zinc-200">
      {TABS.map((t) => {
        const active = t.id === tab;
        return (
          <button key={t.id} role="tab" aria-selected={active} onClick={() => setTab(t.id)}
            className={`h-9 px-3 text-[13px] font-medium border-b-2 -mb-px ${active ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-700'}`}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ComingSoonNote({ provider }: { provider: CloudProvider }) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 flex items-start gap-2" data-testid="coming-soon-note">
      <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
      <span><span className="font-medium">Coming soon.</span> {cloudProviderInfo(provider).label} credential shapes are accepted and validated, but provisioning isn&apos;t wired for this provider yet — creating a cluster with it is rejected with a clear message. There is no pseudo-success path.</span>
    </div>
  );
}

export function CloudProviderDetail({ providerId }: { providerId: string }) {
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrg();
  const known = CLOUD_PROVIDERS.some((p) => p.id === providerId.toLowerCase());
  const info = cloudProviderInfo(providerId);
  const provider = info.id;

  const [tab, setTab] = useState<Tab>('overview');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CloudCredential | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const credsQ = useQuery({
    queryKey: ['cloud-credentials', orgId],
    queryFn: () => getCloudCredentials(orgId!),
    enabled: !!orgId,
  });
  const creds = useMemo(
    () => (credsQ.data?.data ?? []).filter((c) => (c.provider ?? '').toLowerCase() === provider),
    [credsQ.data, provider],
  );
  const credIds = useMemo(() => new Set(creds.map((c) => c.id)), [creds]);

  // Clusters provisioned with this provider — cross-reference CREATE provisioning jobs -> credential_id.
  const clustersQ = useQuery({
    queryKey: ['provider-clusters', orgId, provider, [...credIds].sort().join(',')],
    enabled: !!orgId && tab === 'clusters' && info.wired && credIds.size > 0,
    queryFn: async (): Promise<Cluster[]> => {
      const list = (await getClusters(orgId!)).data.slice(0, 40);
      const matched: Cluster[] = [];
      for (const c of list) {
        try {
          const jobs = await getProvisioningJobs(c.id);
          if (jobs.some((j) => j.action === 'CREATE' && j.credential_id && credIds.has(j.credential_id))) matched.push(c);
        } catch {
          /* skip */
        }
      }
      return matched;
    },
  });

  const create = useMutation({
    mutationFn: (d: CloudCredentialCreate) => createCloudCredential(orgId!, d),
    onSuccess: () => { setShowForm(false); setEditing(null); setFormError(null); queryClient.invalidateQueries({ queryKey: ['cloud-credentials', orgId] }); },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Failed to create credential'),
  });
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: CloudCredentialUpdate }) => updateCloudCredential(id, d),
    onSuccess: () => { setShowForm(false); setEditing(null); setFormError(null); queryClient.invalidateQueries({ queryKey: ['cloud-credentials', orgId] }); },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Failed to update credential'),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteCloudCredential(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cloud-credentials', orgId] }),
  });

  const onFormSubmit = (data: CloudCredentialCreate | CloudCredentialUpdate, isEdit: boolean) => {
    setFormError(null);
    if (isEdit && editing) update.mutate({ id: editing.id, d: data as CloudCredentialUpdate });
    else create.mutate(data as CloudCredentialCreate);
  };
  const openCreate = () => { setEditing(null); setFormError(null); setShowForm(true); };
  const openEdit = (c: CloudCredential) => { setEditing(c); setFormError(null); setShowForm(true); };

  if (!known) {
    return (
      <div className="px-8 py-8 max-w-3xl space-y-4">
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">Unknown provider <span className="font-mono">{providerId}</span>.</div>
        <Button variant="outline" size="sm" asChild><Link href="/settings/cloud-credentials">Back to providers</Link></Button>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2"><Link href="/settings/cloud-credentials"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Cloud providers</Link></Button>
      </div>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${info.wired ? 'bg-orange-100' : 'bg-zinc-200'}`}><Cloud className={`h-5 w-5 ${info.wired ? 'text-orange-600' : 'text-zinc-400'}`} /></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{info.label}</h1>
              {info.wired
                ? <Badge className="bg-emerald-100 text-emerald-700 font-normal text-xs">Wired</Badge>
                : <Badge className="bg-zinc-200 text-zinc-600 font-normal text-xs" data-testid="provider-coming-soon-badge">Coming soon</Badge>}
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">{provider}</p>
          </div>
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === 'overview' && (
        <div className="space-y-4">
          {!info.wired && <ComingSoonNote provider={provider} />}
          <Card className="border-zinc-200"><CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-sm">
              <div><p className="text-xs text-zinc-400">Provisioning</p><p className="text-zinc-900 mt-0.5">{info.wired ? 'Wired' : 'Coming soon'}</p></div>
              <div><p className="text-xs text-zinc-400">Credentials</p><p className="text-zinc-900 mt-0.5 tabular-nums" data-testid="overview-credential-count">{creds.length}</p></div>
              <div><p className="text-xs text-zinc-400">Provider id</p><p className="text-zinc-900 mt-0.5 font-mono">{provider}</p></div>
              <div><p className="text-xs text-zinc-400">Credential shape</p><p className="text-zinc-900 mt-0.5">{provider === 'ssh' ? 'user + hosts[] + private key' : 'region + access key'}</p></div>
            </div>
          </CardContent></Card>
        </div>
      )}

      {tab === 'clusters' && (
        <Card className="border-zinc-200"><CardContent className="pt-6">
          {!info.wired ? (
            <p className="text-sm text-zinc-500">No clusters — provisioning isn&apos;t wired for {info.label} yet.</p>
          ) : credIds.size === 0 ? (
            <p className="text-sm text-zinc-500">No {info.label} credentials yet, so no clusters can have been provisioned with this provider.</p>
          ) : clustersQ.isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-zinc-400" /></div>
          ) : (clustersQ.data ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">No clusters have been provisioned with a {info.label} credential.</p>
          ) : (
            <div className="space-y-2" data-testid="provider-clusters">
              {(clustersQ.data ?? []).map((c) => (
                <Link key={c.id} href={`/clusters/${c.id}`} className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 hover:border-zinc-300">
                  <span className="text-sm font-medium text-zinc-900 flex items-center gap-2"><Server className="h-4 w-4 text-zinc-400" /> {c.name}</span>
                  <span className="text-xs text-zinc-400 capitalize">{c.status}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent></Card>
      )}

      {tab === 'credentials' && (
        <div className="space-y-4">
          {!info.wired && <ComingSoonNote provider={provider} />}
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{provider === 'ssh' ? 'SSH host credentials' : `${info.label} access keys`} used for provisioning.</p>
            {!showForm && <Button size="sm" onClick={openCreate} data-testid="add-credential"><Plus className="h-4 w-4 mr-1" /> Add credential</Button>}
          </div>
          {showForm && (
            <CredentialForm provider={provider} editing={editing} saving={create.isPending || update.isPending} error={formError} onCancel={() => { setShowForm(false); setEditing(null); setFormError(null); }} onSubmit={onFormSubmit} />
          )}
          {credsQ.isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-zinc-400" /></div>
          ) : creds.length === 0 && !showForm ? (
            <Card className="border-zinc-200 border-dashed"><CardContent className="py-10 text-center text-sm text-zinc-500" data-testid="no-credentials">No {info.label} credentials yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {creds.map((c) => (
                <Card key={c.id} className="border-zinc-200" data-testid="credential-row"><CardContent className="pt-4 pb-3 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0"><Cloud className="h-4 w-4 text-orange-600" /></div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{c.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {provider === 'ssh'
                          ? `${c.user ?? 'user?'} @ ${(c.hosts ?? []).length} host${(c.hosts ?? []).length === 1 ? '' : 's'}`
                          : `${c.region ?? 'region?'} · key ${mask(c.access_key_id)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)} data-testid="edit-credential">Edit</Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" disabled={del.isPending} onClick={() => del.mutate(c.id)} data-testid="remove-credential"><Trash2 className="h-4 w-4 mr-1" /> Remove</Button>
                  </div>
                </CardContent></Card>
              ))}
              {del.error instanceof Error && <p className="text-xs text-red-700">{del.error.message}</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <Card className="border-zinc-200"><CardContent className="py-8">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5 bg-zinc-100 text-zinc-500">Not yet available</span>
            <span className="text-sm font-semibold text-zinc-900">Activity &amp; audit for {info.label}</span>
          </div>
          <p className="text-sm text-zinc-500">Credential changes and provisioning events for this provider will appear here once the cross-resource activity/audit log is wired into this surface.</p>
          <p className="text-xs text-zinc-400 mt-1.5 font-mono">tracked by kn-b10</p>
        </CardContent></Card>
      )}
    </div>
  );
}
