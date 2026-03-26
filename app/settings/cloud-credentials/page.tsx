'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cloud, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
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
import {
  getCloudCredentials,
  createCloudCredential,
  updateCloudCredential,
  deleteCloudCredential,
} from '@/api/cloud-credentials';
import type { CloudCredential, CloudProvider } from '@/types/api';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-south-1', 'ap-southeast-1', 'ap-northeast-1',
];

function maskKeyId(value: string): string {
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
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
  provider: 'AWS',
  access_key_id: '',
  secret_access_key: '',
  region: 'us-east-1',
};

export default function CloudCredentialsPage() {
  const { isAuthenticated } = useAuth(true);
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const fetchCredentials = useCallback(async () => {
    try {
      setError(null);
      const res = await getCloudCredentials();
      setCredentials(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchCredentials();
  }, [isAuthenticated, fetchCredentials]);

  if (!isAuthenticated) return null;

  async function handleSave() {
    if (!form.name || !form.access_key_id || !form.region) return;
    if (!editingId && !form.secret_access_key) return;

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const update: Record<string, string> = {
          name: form.name,
          region: form.region,
          access_key_id: form.access_key_id,
        };
        if (form.secret_access_key) update.secret_access_key = form.secret_access_key;
        await updateCloudCredential(editingId, update);
      } else {
        await createCloudCredential({
          name: form.name,
          provider: form.provider,
          access_key_id: form.access_key_id,
          secret_access_key: form.secret_access_key,
          region: form.region,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await fetchCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(cred: CloudCredential) {
    setForm({
      name: cred.name,
      provider: cred.provider,
      access_key_id: cred.access_key_id,
      secret_access_key: '',
      region: cred.region,
    });
    setEditingId(cred.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteCloudCredential(id);
      await fetchCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete credential');
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  if (loading) {
    return (
      <div className="px-8 py-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
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
          <Button size="sm" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError(null); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Credential
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
                  placeholder="e.g. aws-prod"
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
                  disabled={!!editingId}
                >
                  <SelectTrigger className="border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AWS">Amazon Web Services</SelectItem>
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
                <Label className="text-xs font-medium text-zinc-600">
                  Secret Access Key
                  {editingId && <span className="text-zinc-400 font-normal ml-1">(leave blank to keep current)</span>}
                </Label>
                <Input
                  type="password"
                  placeholder={editingId ? '••••••••' : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'}
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
                disabled={saving || !form.name || !form.access_key_id || (!editingId && !form.secret_access_key)}
              >
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
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
          {credentials.map((cred) => (
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
                        <Badge className="text-xs font-normal bg-orange-100 text-orange-700">
                          {cred.provider}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-500">
                        <div>
                          <span className="text-zinc-400">Key ID:</span>{' '}
                          <span className="font-mono">{maskKeyId(cred.access_key_id)}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400">Region:</span>{' '}
                          <span className="font-mono">{cred.region}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
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
          ))}
        </div>
      )}
    </div>
  );
}
