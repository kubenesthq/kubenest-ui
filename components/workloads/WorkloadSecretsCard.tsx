'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Key, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWorkloadSecrets, useSetWorkloadSecrets, useRemoveWorkloadSecret } from '@/hooks/useWorkloadSecrets';

interface WorkloadSecretsCardProps {
  workloadId: string;
}

export function WorkloadSecretsCard({ workloadId }: WorkloadSecretsCardProps) {
  const { data: secretList, isLoading } = useWorkloadSecrets(workloadId);
  const setSecretsMutation = useSetWorkloadSecrets(workloadId);
  const removeSecretMutation = useRemoveWorkloadSecret(workloadId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEntries, setNewEntries] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const secrets = secretList?.secrets ?? [];

  const addEntry = () => setNewEntries([...newEntries, { key: '', value: '' }]);
  const removeEntry = (idx: number) => setNewEntries(newEntries.filter((_, i) => i !== idx));
  const updateEntry = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...newEntries];
    updated[idx][field] = val;
    setNewEntries(updated);
  };

  const handleAdd = () => {
    const valid = newEntries.filter((e) => e.key.trim() && e.value.trim());
    if (valid.length === 0) return;
    const secretsMap = Object.fromEntries(valid.map((e) => [e.key.trim(), e.value]));
    setError(null);
    setSecretsMutation.mutate(secretsMap, {
      onSuccess: () => {
        setShowAddDialog(false);
        setNewEntries([{ key: '', value: '' }]);
      },
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to save secrets'),
    });
  };

  const confirmDelete = () => {
    if (!deleteKey) return;
    removeSecretMutation.mutate(deleteKey, {
      onSuccess: () => setDeleteKey(null),
    });
  };

  if (isLoading) {
    return (
      <Card className="border-zinc-200">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-zinc-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-zinc-900">Secrets</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Secrets
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {secrets.length > 0 ? (
            <div className="space-y-2">
              {secrets.map((secret) => (
                <div
                  key={secret.key}
                  className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-md border border-zinc-100"
                >
                  <div className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5 text-zinc-400" />
                    <code className="text-xs font-mono text-zinc-700">{secret.key}</code>
                    <span className="text-xs text-zinc-400">
                      {format(new Date(secret.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-red-500"
                    onClick={() => setDeleteKey(secret.key)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-zinc-200 rounded-lg p-6 text-center">
              <Key className="h-6 w-6 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">No secrets configured.</p>
              <p className="text-xs text-zinc-400 mt-0.5">Secrets are injected as environment variables at runtime.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Secrets Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Secrets</DialogTitle>
            <DialogDescription>
              Secrets are stored encrypted and injected as environment variables.
              Values are never displayed after saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {newEntries.map((entry, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Label className="text-xs text-zinc-500">Key</Label>
                  <Input
                    placeholder="DATABASE_URL"
                    value={entry.key}
                    onChange={(e) => updateEntry(idx, 'key', e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-zinc-500">Value</Label>
                  <Input
                    type="password"
                    placeholder="secret value"
                    value={entry.value}
                    onChange={(e) => updateEntry(idx, 'value', e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                {newEntries.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-5 h-8 w-8 p-0 text-zinc-400 hover:text-red-500"
                    onClick={() => removeEntry(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={addEntry}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Another
          </Button>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={setSecretsMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={setSecretsMutation.isPending}>
              {setSecretsMutation.isPending ? 'Saving...' : 'Save Secrets'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteKey} onOpenChange={() => setDeleteKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Secret</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <code className="font-mono">{deleteKey}</code>? The workload will need to be redeployed for the change to take effect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteKey(null)} disabled={removeSecretMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={removeSecretMutation.isPending}>
              {removeSecretMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
