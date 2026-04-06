'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { useStackTemplate, useDeployStackTemplate } from '@/hooks/useStackTemplates';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import type { ProjectListResponse } from '@/types/api';

export default function StackDeployPage() {
  return (
    <Suspense>
      <StackDeployForm />
    </Suspense>
  );
}

function StackDeployForm() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const ns = searchParams.get('ns') || '';
  const name = searchParams.get('name') || '';

  const { data: template, isLoading: templateLoading } = useStackTemplate(ns, name);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [deployed, setDeployed] = useState(false);
  const [deployResult, setDeployResult] = useState<{ deploy_name: string; namespace: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deployMutation = useDeployStackTemplate(ns, name);

  // Fetch projects for the project selector
  const { data: projectsData } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => apiClient.get<ProjectListResponse>('/projects'),
  });
  const projects = projectsData?.data ?? [];

  // Initialize parameter defaults when template loads
  const parameters = template?.parameters ?? {};
  const paramEntries = Object.entries(parameters);

  const handleDeploy = () => {
    if (!selectedProjectId) return;
    setError(null);

    // Build parameter values, using defaults for unfilled
    const resolvedParams: Record<string, unknown> = {};
    for (const [key, spec] of paramEntries) {
      const userVal = paramValues[key];
      if (userVal !== undefined && userVal !== '') {
        resolvedParams[key] = spec.type === 'integer' ? parseInt(userVal) : spec.type === 'boolean' ? userVal === 'true' : userVal;
      }
    }

    deployMutation.mutate(
      {
        project_id: selectedProjectId,
        parameters: Object.keys(resolvedParams).length > 0 ? resolvedParams : undefined,
      },
      {
        onSuccess: (result) => {
          setDeployed(true);
          setDeployResult(result);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Deployment failed');
        },
      }
    );
  };

  if (!isAuthenticated) return null;

  if (templateLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="px-8 py-8 max-w-2xl">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-400">
            Template not found. Make sure the namespace and name are correct.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-2xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Deploy: {template.name}</h1>
        {template.description && (
          <p className="text-sm text-zinc-500 mt-1">{template.description}</p>
        )}
        <div className="flex gap-1.5 mt-2">
          {template.components.map((c) => (
            <Badge key={c.name} variant="secondary" className="text-xs bg-zinc-100 text-zinc-600">
              {c.name} ({c.type})
            </Badge>
          ))}
        </div>
      </div>

      {deployed ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-medium text-emerald-800">Stack Deployed!</h2>
            <p className="text-sm text-emerald-600">
              {deployResult?.deploy_name} is being provisioned in namespace {deployResult?.namespace}.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => router.push(`/projects/${selectedProjectId}`)}>
                View Project
              </Button>
              <Button size="sm" onClick={() => router.push('/settings/stack-templates')}>
                Deploy Another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-zinc-200">
          <CardContent className="pt-6 space-y-4">
            {/* Project selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-600">Target Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.namespace})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template parameters */}
            {paramEntries.length > 0 && (
              <>
                <p className="text-sm text-zinc-500">Configure template parameters:</p>
                {paramEntries.map(([key, spec]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key} className="text-xs font-medium text-zinc-600">
                      {key}
                      {spec.required && <span className="text-red-500 ml-0.5">*</span>}
                    </Label>
                    {spec.type === 'boolean' ? (
                      <Select
                        value={paramValues[key] ?? String(spec.default ?? 'false')}
                        onValueChange={(v) => setParamValues({ ...paramValues, [key]: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">true</SelectItem>
                          <SelectItem value="false">false</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={key}
                        type={spec.type === 'integer' ? 'number' : 'text'}
                        placeholder={spec.default !== undefined ? String(spec.default) : ''}
                        value={paramValues[key] ?? ''}
                        onChange={(e) => setParamValues({ ...paramValues, [key]: e.target.value })}
                        className="border-zinc-200"
                      />
                    )}
                    {spec.description && <p className="text-xs text-zinc-400">{spec.description}</p>}
                    {spec.generator && (
                      <p className="text-xs text-blue-500">Auto-generated ({spec.generator})</p>
                    )}
                  </div>
                ))}
              </>
            )}

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <Button
              className="w-full mt-4"
              onClick={handleDeploy}
              disabled={deployMutation.isPending || !selectedProjectId}
            >
              {deployMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                'Deploy Stack'
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
