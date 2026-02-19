'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { addonDefinitionsApi } from '@/lib/api/addons';
import type { AddonDefinition } from '@/types/api';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

export default function AdminAddonDefinitionsPage() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<AddonDefinition | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['addon-definitions'],
    queryFn: () => addonDefinitionsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => addonDefinitionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-definitions'] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      alert(`Failed to delete: ${err.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      addonDefinitionsApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-definitions'] });
    },
  });

  const definitions = data?.data ?? [];

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, ease: easeOutQuart }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Addon Catalog</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage addon definitions available to projects
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/addon-definitions/new">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Definition
          </Link>
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">Definitions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-sm text-red-500">
                Failed to load definitions: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            ) : definitions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-zinc-200 rounded-lg text-center">
                <p className="text-sm font-medium text-zinc-500 mb-1">No addon definitions yet</p>
                <p className="text-xs text-zinc-400 mb-4">Create one to populate the catalog</p>
                <Button asChild size="sm">
                  <Link href="/admin/addon-definitions/new">Create Definition</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left text-xs font-medium uppercase tracking-wide text-zinc-400 pb-2 pr-4">
                        Name
                      </th>
                      <th className="text-left text-xs font-medium uppercase tracking-wide text-zinc-400 pb-2 pr-4">
                        Slug
                      </th>
                      <th className="text-left text-xs font-medium uppercase tracking-wide text-zinc-400 pb-2 pr-4">
                        Type
                      </th>
                      <th className="text-left text-xs font-medium uppercase tracking-wide text-zinc-400 pb-2 pr-4">
                        Scope
                      </th>
                      <th className="text-left text-xs font-medium uppercase tracking-wide text-zinc-400 pb-2 pr-4">
                        Created
                      </th>
                      <th className="text-left text-xs font-medium uppercase tracking-wide text-zinc-400 pb-2 pr-4">
                        Active
                      </th>
                      <th className="text-right text-xs font-medium uppercase tracking-wide text-zinc-400 pb-2">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {definitions.map((def: AddonDefinition, i: number) => (
                      <motion.tr
                        key={def.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-base leading-none">{def.icon}</span>
                            <span className="font-medium text-zinc-900">{def.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <code className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                            {def.slug}
                          </code>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="capitalize text-zinc-700">{def.type}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-zinc-500">
                            {def.cluster_id ? 'Cluster' : 'Global'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-zinc-500">
                          {format(new Date(def.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: def.id,
                                is_active: !def.is_active,
                              })
                            }
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                              def.is_active ? 'bg-emerald-500' : 'bg-zinc-200'
                            }`}
                            aria-label={def.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                def.is_active ? 'translate-x-4' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Link href={`/admin/addon-definitions/${def.id}/edit`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteTarget(def)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Addon Definition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteTarget?.name}</strong>? This will remove it from the catalog and
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
