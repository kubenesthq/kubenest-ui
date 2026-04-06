'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useCreateStackTemplate } from '@/hooks/useStackTemplates';
import type { StackTemplateCreate } from '@/lib/api/stack-templates';

interface ComponentDraft {
  name: string;
  type: 'workload' | 'addon';
  chart_repo: string;
  chart_name: string;
  chart_version: string;
  // workload-specific
  image: string;
  replicas: number;
  port: number;
}

const emptyComponent = (type: 'workload' | 'addon'): ComponentDraft => ({
  name: '',
  type,
  chart_repo: '',
  chart_name: '',
  chart_version: '',
  image: '',
  replicas: 1,
  port: 8080,
});

export default function NewStackTemplatePage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();
  const createMutation = useCreateStackTemplate();

  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('');
  const [description, setDescription] = useState('');
  const [components, setComponents] = useState<ComponentDraft[]>([emptyComponent('workload')]);
  const [error, setError] = useState<string | null>(null);

  const addComponent = (type: 'workload' | 'addon') => {
    setComponents([...components, emptyComponent(type)]);
  };

  const removeComponent = (idx: number) => {
    if (components.length <= 1) return;
    setComponents(components.filter((_, i) => i !== idx));
  };

  const updateComponent = (idx: number, updates: Partial<ComponentDraft>) => {
    const updated = [...components];
    updated[idx] = { ...updated[idx], ...updates };
    setComponents(updated);
  };

  const handleSubmit = () => {
    if (!name.trim() || !namespace.trim()) return;
    if (components.some((c) => !c.name.trim())) return;

    setError(null);

    const payload: StackTemplateCreate = {
      name: name.trim(),
      namespace: namespace.trim(),
      description: description.trim() || undefined,
      components: components.map((c) => {
        const hasChart = c.chart_repo && c.chart_name && c.chart_version;

        if (c.type === 'workload') {
          return {
            name: c.name.trim(),
            type: 'workload' as const,
            workload_spec: {
              ...(c.image ? { image: c.image } : {}),
              replicas: c.replicas,
              port: c.port,
              ...(hasChart ? { chart: { repo: c.chart_repo, name: c.chart_name, version: c.chart_version } } : {}),
            },
          };
        } else {
          return {
            name: c.name.trim(),
            type: 'addon' as const,
            addon_spec: {
              chart: { repo: c.chart_repo, name: c.chart_name, version: c.chart_version },
              ...(c.chart_name ? {} : {}),
            },
          };
        }
      }),
    };

    createMutation.mutate(payload, {
      onSuccess: () => router.push('/settings/stack-templates'),
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create template'),
    });
  };

  if (!isAuthenticated) return null;

  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Create Stack Template</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Define a reusable stack with workloads and addons from Helm charts.</p>
      </div>

      <Card className="border-zinc-200">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tpl-name">Template Name</Label>
              <Input
                id="tpl-name"
                placeholder="my-fullstack-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tpl-ns">Namespace</Label>
              <Input
                id="tpl-ns"
                placeholder="default"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea
              id="tpl-desc"
              placeholder="What does this stack do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Components */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">Components</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addComponent('workload')}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Workload
            </Button>
            <Button variant="outline" size="sm" onClick={() => addComponent('addon')}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Addon
            </Button>
          </div>
        </div>

        {components.map((comp, idx) => (
          <Card key={idx} className="border-zinc-200">
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {comp.type === 'workload' ? 'Workload' : 'Addon'} #{idx + 1}
                </span>
                {components.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-red-500"
                    onClick={() => removeComponent(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div>
                <Label>Component Name</Label>
                <Input
                  placeholder={comp.type === 'workload' ? 'api-server' : 'postgres'}
                  value={comp.name}
                  onChange={(e) => updateComponent(idx, { name: e.target.value })}
                />
              </div>

              {comp.type === 'workload' && (
                <div>
                  <Label>Image (if not using a chart)</Label>
                  <Input
                    placeholder="nginx:1.21"
                    value={comp.image}
                    onChange={(e) => updateComponent(idx, { image: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {comp.type === 'workload' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Replicas</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={comp.replicas}
                      onChange={(e) => updateComponent(idx, { replicas: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      value={comp.port}
                      onChange={(e) => updateComponent(idx, { port: parseInt(e.target.value) || 8080 })}
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-zinc-100 pt-3">
                <p className="text-xs font-medium text-zinc-500 mb-2">
                  Helm Chart {comp.type === 'addon' ? '(required)' : '(optional)'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Chart Repo URL</Label>
                    <Input
                      placeholder="https://charts.bitnami.com/bitnami"
                      value={comp.chart_repo}
                      onChange={(e) => updateComponent(idx, { chart_repo: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>Chart Name</Label>
                    <Input
                      placeholder="postgresql"
                      value={comp.chart_name}
                      onChange={(e) => updateComponent(idx, { chart_name: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>Version</Label>
                    <Input
                      placeholder="16.4.0"
                      value={comp.chart_version}
                      onChange={(e) => updateComponent(idx, { chart_version: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || !name.trim() || !namespace.trim() || components.some((c) => !c.name.trim())}
        >
          {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Create Template
        </Button>
      </div>
    </div>
  );
}
