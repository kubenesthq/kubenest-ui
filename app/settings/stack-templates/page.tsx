'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Database, Globe, Search, Trash2, Download, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useStackTemplates, useDeleteStackTemplate, useRegistryTemplates, useInstallRegistryTemplate } from '@/hooks/useStackTemplates';
import type { StackTemplateRead } from '@/lib/api/stack-templates';

export default function StacksPage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StackTemplateRead | null>(null);
  const [installNamespace, setInstallNamespace] = useState('');
  const [installTarget, setInstallTarget] = useState<string | null>(null);

  const { data: templateList, isLoading } = useStackTemplates();
  const { data: registryList, isLoading: registryLoading } = useRegistryTemplates();
  const deleteMutation = useDeleteStackTemplate();
  const installMutation = useInstallRegistryTemplate();

  const templates = templateList?.data ?? [];
  const registryTemplates = registryList?.data ?? [];

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredRegistry = registryTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (template: StackTemplateRead, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(template);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { namespace: deleteTarget.namespace, name: deleteTarget.name },
      { onSuccess: () => setDeleteTarget(null) }
    );
  };

  const handleInstall = (name: string) => {
    if (!installNamespace) return;
    installMutation.mutate(
      { name, namespace: installNamespace },
      {
        onSuccess: () => {
          setInstallTarget(null);
          setInstallNamespace('');
        },
      }
    );
  };

  if (!isAuthenticated) return null;

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Stack Templates</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Deploy pre-configured application stacks in one click.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-zinc-200"
        />
      </div>

      {/* Your Templates (from backend API) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Your Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={`${template.namespace}/${template.name}`} className="border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer group">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-9 w-9 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
                      <Layers className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-zinc-900 group-hover:text-violet-600 transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{template.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.components.map((c) => (
                      <Badge key={c.name} variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                        {c.type === 'addon' ? <Database className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
                        {c.name}
                      </Badge>
                    ))}
                    {template.tags?.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/stacks/deploy?ns=${template.namespace}&name=${template.name}`)}
                    >
                      Deploy Stack
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-zinc-400 hover:text-red-500"
                      onClick={(e) => handleDelete(template, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : !search ? (
        <div className="border-2 border-dashed border-zinc-200 rounded-lg p-8 text-center">
          <Layers className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No stack templates yet.</p>
          <p className="text-xs text-zinc-400 mt-1">Create one from a project or install from the community registry below.</p>
        </div>
      ) : null}

      {/* Community Registry */}
      {registryLoading ? null : filteredRegistry.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Community Registry</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRegistry.map((template) => (
              <Card key={template.name} className="border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all group">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                      <Globe className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-zinc-900 group-hover:text-blue-600 transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{template.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                      v{template.version}
                    </Badge>
                    {template.tags?.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setInstallTarget(template.name)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Install Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Dialog (asks for namespace) */}
      <Dialog open={!!installTarget} onOpenChange={() => { setInstallTarget(null); setInstallNamespace(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Template</DialogTitle>
            <DialogDescription>
              Choose a namespace to install <strong>{installTarget}</strong> into.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Namespace (e.g. default)"
            value={installNamespace}
            onChange={(e) => setInstallNamespace(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInstallTarget(null); setInstallNamespace(''); }} disabled={installMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => installTarget && handleInstall(installTarget)} disabled={installMutation.isPending || !installNamespace}>
              {installMutation.isPending ? 'Installing...' : 'Install'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
