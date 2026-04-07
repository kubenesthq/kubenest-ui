'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Layers, Database, Globe, Rocket, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useStackTemplate } from '@/hooks/useStackTemplates';

function jsonToYaml(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return `${pad}null`;
  if (typeof obj === 'string') return obj.includes('\n') ? `|\n${obj.split('\n').map(l => `${pad}  ${l}`).join('\n')}` : obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        const lines = jsonToYaml(item, indent + 1).split('\n');
        return `${pad}- ${lines[0].trim()}\n${lines.slice(1).map(l => `${pad}  ${l.trimStart()}`).join('\n')}`;
      }
      return `${pad}- ${jsonToYaml(item, 0)}`;
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
        return `${pad}${key}:\n${jsonToYaml(value, indent + 1)}`;
      }
      if (Array.isArray(value)) {
        return `${pad}${key}:\n${jsonToYaml(value, indent + 1)}`;
      }
      return `${pad}${key}: ${jsonToYaml(value, 0)}`;
    }).join('\n');
  }
  return String(obj);
}

function templateToYaml(template: { name: string; namespace: string; version: string; description?: string | null; scope: string; components: unknown[]; parameters?: unknown | null }) {
  const doc: Record<string, unknown> = {
    apiVersion: 'apps.kubenest.io/v1',
    kind: 'StackTemplate',
    metadata: { name: template.name, namespace: template.namespace },
    spec: {
      version: template.version,
      ...(template.description ? { description: template.description } : {}),
      scope: template.scope,
      components: template.components,
      ...(template.parameters ? { parameters: template.parameters } : {}),
    },
  };
  return jsonToYaml(doc);
}

export default function StackTemplateDetailPage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();
  const params = useParams();
  const namespace = params.namespace as string;
  const name = params.name as string;
  const [copied, setCopied] = useState(false);

  const { data: template, isLoading, error } = useStackTemplate(namespace, name);

  const handleCopy = () => {
    if (!template) return;
    navigator.clipboard.writeText(templateToYaml(template));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="px-8 py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-zinc-200 rounded w-24" />
          <div className="h-8 bg-zinc-200 rounded w-64" />
          <div className="h-64 bg-zinc-100 rounded" />
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="px-8 py-8 max-w-4xl space-y-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Template not found or failed to load.
        </div>
      </div>
    );
  }

  const yamlContent = templateToYaml(template);

  return (
    <div className="px-8 py-8 max-w-4xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{template.name}</h1>
            {template.description && (
              <p className="text-sm text-zinc-500 mt-0.5">{template.description}</p>
            )}
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">v{template.version}</Badge>
              <Badge variant="outline" className="text-xs">{template.scope}</Badge>
              {template.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
        <Button onClick={() => router.push(`/stacks/deploy?ns=${namespace}&name=${name}`)}>
          <Rocket className="h-4 w-4 mr-1.5" />
          Deploy Stack
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="yaml">YAML</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mt-4">
            Components ({template.components.length})
          </h2>
          <div className="space-y-3">
            {template.components.map((comp) => (
              <Card key={comp.name} className="border-zinc-200">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`h-8 w-8 rounded-md flex items-center justify-center ${comp.type === 'addon' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      {comp.type === 'addon' ? <Database className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{comp.name}</p>
                      <p className="text-xs text-zinc-400">{comp.type}</p>
                    </div>
                  </div>
                  {comp.type === 'workload' && comp.workloadSpec && (() => {
                    const ws = comp.workloadSpec as Record<string, string | number>;
                    return (
                      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-zinc-100">
                        {ws.image ? (
                          <div>
                            <p className="text-xs text-zinc-400">Image</p>
                            <p className="text-sm font-mono text-zinc-700">{String(ws.image)}</p>
                          </div>
                        ) : null}
                        {ws.replicas !== undefined ? (
                          <div>
                            <p className="text-xs text-zinc-400">Replicas</p>
                            <p className="text-sm text-zinc-700">{String(ws.replicas)}</p>
                          </div>
                        ) : null}
                        {ws.port !== undefined ? (
                          <div>
                            <p className="text-xs text-zinc-400">Port</p>
                            <p className="text-sm text-zinc-700">{String(ws.port)}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                  {comp.type === 'addon' && comp.addonSpec && (() => {
                    const as_ = comp.addonSpec as Record<string, Record<string, string>>;
                    return as_.chart ? (
                      <div className="mt-3 pt-3 border-t border-zinc-100">
                        <div>
                          <p className="text-xs text-zinc-400">Chart</p>
                          <p className="text-sm font-mono text-zinc-700">
                            {as_.chart.name || ''}
                            {' '}
                            <span className="text-zinc-400">{as_.chart.version || ''}</span>
                          </p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  {comp.dependsOn && comp.dependsOn.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-100">
                      <p className="text-xs text-zinc-400">Depends on</p>
                      <div className="flex gap-1 mt-1">
                        {comp.dependsOn.map((dep) => (
                          <Badge key={dep} variant="secondary" className="text-xs">{dep}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {template.parameters && Object.keys(template.parameters).length > 0 && (
            <>
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mt-6">
                Deploy-time Parameters ({Object.keys(template.parameters).length})
              </h2>
              <Card className="border-zinc-200">
                <CardContent className="pt-4 pb-3">
                  <div className="space-y-3">
                    {Object.entries(template.parameters).map(([key, param]) => (
                      <div key={key} className="flex items-start justify-between py-2 border-b border-zinc-50 last:border-0">
                        <div>
                          <p className="text-sm font-mono text-zinc-900">{key}</p>
                          {param.description && <p className="text-xs text-zinc-500 mt-0.5">{param.description}</p>}
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{param.type}</Badge>
                            <Badge variant="outline" className="text-xs">{param.component} / {param.path}</Badge>
                            {param.required && <Badge variant="destructive" className="text-xs">required</Badge>}
                            {param.generator && <Badge variant="secondary" className="text-xs">auto: {param.generator}</Badge>}
                          </div>
                        </div>
                        {param.default !== undefined && (
                          <p className="text-xs font-mono text-zinc-400">default: {String(param.default)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* YAML Tab */}
        <TabsContent value="yaml">
          <div className="relative mt-4">
            <Button
              variant="outline"
              size="sm"
              className="absolute top-3 right-3 z-10"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-6 pr-24 overflow-x-auto text-sm font-mono leading-relaxed">
              {yamlContent}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
