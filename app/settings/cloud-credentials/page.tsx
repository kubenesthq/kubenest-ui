'use client';

import { useState, useEffect } from 'react';
import { Cloud, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import type { CloudCredential, CloudProvider } from '@/types/api';

const STORAGE_KEY = 'kubenest-cloud-credentials';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-south-1', 'ap-southeast-1', 'ap-northeast-1',
];

const providerColors: Record<CloudProvider, string> = {
  aws: 'bg-orange-100 text-orange-700',
  gcp: 'bg-blue-100 text-blue-700',
  azure: 'bg-sky-100 text-sky-700',
};

function maskSecret(value: string): string {
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

function loadCredentials(): CloudCredential[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveCredentials(creds: CloudCredential[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

interface FormData {
  name: string;
  provider: CloudProvider;
  access_key_id: string;
  secret_access_key: string;
  region: string;
}

const emptyForm: FormData = {
  name: '',
  provider: 'aws',
  access_key_id: '',
  secret_access_key: '',
  region: 'us-east-1',
};

export default function CloudCredentialsPage() {
  const { isAuthenticated } = useAuth(true);
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCredentials(loadCredentials());
  }, []);

  if (!isAuthenticated) return null;

  function handleSave() {
    if (!form.name || !form.access_key_id || !form.secret_access_key || !form.region) return;

    const now = new Date().toISOString();
    let updated: CloudCredential[];

    if (editingId) {
      updated = credentials.map((c) =>
        c.id === editingId
          ? { ...c, ...form, updated_at: now }
          : c
      );
    } else {
      const newCred: CloudCredential = {
        id: crypto.randomUUID(),
        ...form,
        created_at: now,
        updated_at: null,
      };
      updated = [...credentials, newCred];
    }

    saveCredentials(updated);
    setCredentials(updated);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleEdit(cred: CloudCredential) {
    setForm({
      name: cred.name,
      provider: cred.provider,
      access_key_id: cred.access_key_id,
      secret_access_key: cred.secret_access_key,
      region: cred.region,
    });
    setEditingId(cred.id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    const updated = credentials.filter((c) => c.id !== id);
    saveCredentials(updated);
    setCredentials(updated);
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Cloud Credentials</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manage cloud provider credentials for cluster provisioning.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Credential
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="border-zinc-200">
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              {editingId ? 'Edit Credential' : 'Add Cloud Credential'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Name</Label>
                <Input
                  placeholder="e.g. Production AWS"
                  className="border-zinc-200"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(v) => setForm({ ...form, provider: v as CloudProvider })}
                >
                  <SelectTrigger className="border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">Amazon Web Services</SelectItem>
                    <SelectItem value="gcp" disabled>Google Cloud Platform (coming soon)</SelectItem>
                    <SelectItem value="azure" disabled>Microsoft Azure (coming soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Access Key ID</Label>
                <Input
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="border-zinc-200 font-mono text-sm"
                  value={form.access_key_id}
                  onChange={(e) => setForm({ ...form, access_key_id: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Secret Access Key</Label>
                <Input
                  type="password"
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="border-zinc-200 font-mono text-sm"
                  value={form.secret_access_key}
                  onChange={(e) => setForm({ ...form, secret_access_key: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Region</Label>
                <Select
                  value={form.region}
                  onValueChange={(v) => setForm({ ...form, region: v })}
                >
                  <SelectTrigger className="border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AWS_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!form.name || !form.access_key_id || !form.secret_access_key}
              >
                {editingId ? 'Update' : 'Save Credential'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credentials List */}
      {credentials.length === 0 && !showForm ? (
        <Card className="border-zinc-200 border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
              <Cloud className="h-6 w-6 text-zinc-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-700">No cloud credentials</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs">
              Add cloud provider credentials to enable automated cluster provisioning.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Credential
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => {
            const revealed = revealedIds.has(cred.id);
            return (
              <Card key={cred.id} className="border-zinc-200">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                        <Cloud className="h-4.5 w-4.5 text-orange-600" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-zinc-900">{cred.name}</h3>
                          <Badge className={`text-xs font-normal ${providerColors[cred.provider]}`}>
                            {cred.provider.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-zinc-500">
                          <div>
                            <span className="text-zinc-400">Key ID:</span>{' '}
                            <span className="font-mono">{maskSecret(cred.access_key_id)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-400">Secret:</span>{' '}
                            <span className="font-mono">
                              {revealed ? cred.secret_access_key : maskSecret(cred.secret_access_key)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-400">Region:</span>{' '}
                            <span className="font-mono">{cred.region}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleReveal(cred.id)}
                        title={revealed ? 'Hide secret' : 'Reveal secret'}
                      >
                        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(cred)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(cred.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
