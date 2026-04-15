'use client';

import { useState } from 'react';
import { ExternalLink, Plus, ShieldCheck, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateWorkload } from '@/hooks/useWorkloads';
import { useToast } from '@/components/ui/use-toast';
import type { Workload, IngressConfig } from '@/types/api';

interface Props {
  workload: Workload;
}

export function WorkloadDomainsTab({ workload }: Props) {
  const { toast } = useToast();
  const update = useUpdateWorkload(workload.id);

  const ingress = workload.ingress_config;
  const hasDomain = !!ingress?.host;

  const [editing, setEditing] = useState(false);
  const [host, setHost] = useState(ingress?.host ?? '');
  const [path, setPath] = useState(ingress?.path ?? '/');

  const saveIngress = (next: IngressConfig, successMsg: string) => {
    update.mutate(
      { ingress: next },
      {
        onSuccess: () => {
          toast({ title: successMsg });
          setEditing(false);
        },
        onError: (err: Error) =>
          toast({ title: 'Update failed', description: err.message, variant: 'error' }),
      }
    );
  };

  const handleSave = () => {
    const trimmedHost = host.trim();
    const trimmedPath = path.trim() || '/';
    if (!trimmedHost) {
      toast({ title: 'Host is required', variant: 'error' });
      return;
    }
    saveIngress(
      {
        enabled: true,
        host: trimmedHost,
        path: trimmedPath,
        tls_secret: null,
        annotations: ingress?.annotations ?? null,
      },
      hasDomain ? 'Domain updated' : 'Domain added'
    );
  };

  const handleRemove = () => {
    if (!confirm('Remove this domain from the workload?')) return;
    saveIngress(
      {
        enabled: false,
        host: null,
        path: '/',
        tls_secret: null,
        annotations: null,
      },
      'Domain removed'
    );
  };

  const startAdd = () => {
    setHost('');
    setPath('/');
    setEditing(true);
  };

  const startEdit = () => {
    setHost(ingress?.host ?? '');
    setPath(ingress?.path ?? '/');
    setEditing(true);
  };

  return (
    <Card className="border-zinc-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-zinc-900">Domains</CardTitle>
          {!hasDomain && !editing && (
            <Button variant="outline" size="sm" onClick={startAdd}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add domain
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <Label className="text-xs text-zinc-500">Host</Label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="app.example.com"
                autoFocus
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Path</Label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              TLS is managed automatically by cert-manager
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={update.isPending}>
                {update.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : hasDomain ? (
                  'Save'
                ) : (
                  'Add domain'
                )}
              </Button>
            </div>
          </div>
        ) : hasDomain && ingress ? (
          <div className="rounded-md border border-zinc-100 bg-zinc-50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Host
                </p>
                <a
                  href={`https://${ingress.host}${ingress.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline truncate"
                >
                  https://{ingress.host}
                  {ingress.path !== '/' && <span className="text-zinc-400">{ingress.path}</span>}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  disabled={update.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  aria-label="Remove domain"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 pt-2 border-t border-zinc-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              TLS managed by cert-manager
            </div>
          </div>
        ) : (
          <div className="rounded-md border-2 border-dashed border-zinc-200 p-8 text-center">
            <p className="text-sm text-zinc-500">No domain configured.</p>
            <p className="text-xs text-zinc-400 mt-1">
              Add one to route external traffic to this workload.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
