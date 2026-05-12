'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Download, Globe, Layers, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import {
  useCreateStackTemplateFromApp,
  useCreateStackTemplateFromChart,
  useDeleteStackTemplate,
  useInstallRegistryTemplate,
  useRegistryTemplates,
  useStackTemplates,
} from '@/hooks/useStackTemplates';
import { apiClient } from '@/lib/api-client';
import type {
  ChartParameterSpec,
  RegistrySource,
  StackTemplateFromChart,
  StackTemplateRead,
} from '@/lib/api/stack-templates';
import type { AppList, ProjectListResponse } from '@/types/api';

type ChartParamType = 'string' | 'integer' | 'boolean';
type ChartParamGenerator = NonNullable<ChartParameterSpec['generator']>;

interface ChartParamDraft {
  key: string;
  type: ChartParamType;
  component: string;
  path: string;
  description: string;
  defaultValue: string;
  required: boolean;
  generator: ChartParamGenerator | '';
}

const CHART_PARAM_GENERATOR_OPTIONS: Record<string, ChartParamGenerator | ''> = {
  _none: '',
  random_hex_32: 'random_hex_32',
  random_hex_16: 'random_hex_16',
  random_password: 'random_password',
  uuid: 'uuid',
};

function parseChartParamGenerator(value: string): ChartParamGenerator | '' {
  return CHART_PARAM_GENERATOR_OPTIONS[value] ?? '';
}

function emptyChartParam(componentName: string): ChartParamDraft {
  return {
    key: '',
    type: 'string',
    component: componentName,
    path: '',
    description: '',
    defaultValue: '',
    required: false,
    generator: '',
  };
}

function coerceDefaultValue(raw: string, type: ChartParamType): unknown {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (type === 'integer') {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (type === 'boolean') {
    return trimmed.toLowerCase() === 'true';
  }
  return raw;
}

export default function StacksPage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StackTemplateRead | null>(null);
  const [installNamespace, setInstallNamespace] = useState('');
  const [installTarget, setInstallTarget] = useState<string | null>(null);

  const [showFromAppDialog, setShowFromAppDialog] = useState(false);
  const [fromAppProjectId, setFromAppProjectId] = useState('');
  const [fromAppSourceKey, setFromAppSourceKey] = useState('');
  const [fromAppName, setFromAppName] = useState('');
  const [fromAppDescription, setFromAppDescription] = useState('');
  const [fromAppPreserveExportRefs, setFromAppPreserveExportRefs] = useState(true);
  const [fromAppError, setFromAppError] = useState<string | null>(null);

  const [showFromChartDialog, setShowFromChartDialog] = useState(false);
  const [chartTemplateName, setChartTemplateName] = useState('');
  const [chartDescription, setChartDescription] = useState('');
  const [chartComponentName, setChartComponentName] = useState('web');
  const [chartComponentType, setChartComponentType] = useState<'workload' | 'addon'>('workload');
  const [chartRepo, setChartRepo] = useState('https://charts.bitnami.com/bitnami');
  const [chartName, setChartName] = useState('nginx');
  const [chartVersion, setChartVersion] = useState('21.0.7');
  const [chartValuesJson, setChartValuesJson] = useState('');
  const [chartParams, setChartParams] = useState<ChartParamDraft[]>([]);
  const [chartError, setChartError] = useState<string | null>(null);

  const [registryDraftRepo, setRegistryDraftRepo] = useState('');
  const [registryDraftRef, setRegistryDraftRef] = useState('');
  const [registryDraftPath, setRegistryDraftPath] = useState('');
  const [registrySource, setRegistrySource] = useState<RegistrySource | undefined>(undefined);

  const { data: templateList, isLoading } = useStackTemplates();
  const { data: registryList, isLoading: registryLoading } = useRegistryTemplates(registrySource);
  const deleteMutation = useDeleteStackTemplate();
  const installMutation = useInstallRegistryTemplate();
  const createFromAppMutation = useCreateStackTemplateFromApp();
  const createFromChartMutation = useCreateStackTemplateFromChart();

  const { data: projectsData } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => apiClient.get<ProjectListResponse>('/projects?items_per_page=100'),
    enabled: showFromAppDialog || showFromChartDialog,
  });
  const projects = projectsData?.data ?? [];

  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: ['apps-for-project', fromAppProjectId],
    queryFn: () => apiClient.get<AppList>(`/apps?project_id=${encodeURIComponent(fromAppProjectId)}`),
    enabled: showFromAppDialog && fromAppProjectId.length > 0,
  });
  const appsForProject = appsData?.data ?? [];

  const selectedSourceApp = appsForProject.find(
    (app) => `${app.namespace}/${app.name}` === fromAppSourceKey,
  );

  const templates = templateList?.data ?? [];
  const registryTemplates = registryList?.data ?? [];

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const filteredRegistry = registryTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const registrySourceLabel = useMemo(() => {
    if (!registrySource?.repo && !registrySource?.ref && !registrySource?.path) {
      return 'default configured source';
    }
    return `${registrySource.repo ?? '(default repo)'} @ ${registrySource.ref ?? '(default ref)'} :: ${registrySource.path ?? '/'}`;
  }, [registrySource]);

  const handleDelete = (template: StackTemplateRead, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(template);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { namespace: deleteTarget.namespace, name: deleteTarget.name },
      { onSuccess: () => setDeleteTarget(null) },
    );
  };

  const handleApplyRegistrySource = () => {
    const next: RegistrySource = {};
    const repo = registryDraftRepo.trim();
    const ref = registryDraftRef.trim();
    const path = registryDraftPath.trim();
    if (repo) next.repo = repo;
    if (ref) next.ref = ref;
    if (path) next.path = path;
    setRegistrySource(Object.keys(next).length > 0 ? next : undefined);
  };

  const handleResetRegistrySource = () => {
    setRegistryDraftRepo('');
    setRegistryDraftRef('');
    setRegistryDraftPath('');
    setRegistrySource(undefined);
  };

  const handleInstall = () => {
    if (!installTarget || !installNamespace.trim()) return;
    installMutation.mutate(
      {
        name: installTarget,
        namespace: installNamespace.trim(),
        source: registrySource,
      },
      {
        onSuccess: () => {
          setInstallTarget(null);
          setInstallNamespace('');
        },
      },
    );
  };

  const resetFromAppDialog = () => {
    setShowFromAppDialog(false);
    setFromAppProjectId('');
    setFromAppSourceKey('');
    setFromAppName('');
    setFromAppDescription('');
    setFromAppPreserveExportRefs(true);
    setFromAppError(null);
  };

  const handleCreateFromApp = () => {
    if (!fromAppProjectId || !selectedSourceApp || !fromAppName.trim()) return;
    setFromAppError(null);
    createFromAppMutation.mutate(
      {
        project_id: fromAppProjectId,
        namespace: selectedSourceApp.namespace,
        name: selectedSourceApp.name,
        data: {
          name: fromAppName.trim(),
          description: fromAppDescription.trim() || undefined,
          preserve_export_refs: fromAppPreserveExportRefs,
        },
      },
      {
        onSuccess: () => resetFromAppDialog(),
        onError: (err) => setFromAppError(err instanceof Error ? err.message : 'Failed to create template from app'),
      },
    );
  };

  const updateChartParam = (index: number, patch: Partial<ChartParamDraft>) => {
    setChartParams((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const addChartParam = () => {
    setChartParams((prev) => [...prev, emptyChartParam(chartComponentName.trim() || 'component')]);
  };

  const removeChartParam = (index: number) => {
    setChartParams((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetFromChartDialog = () => {
    setShowFromChartDialog(false);
    setChartTemplateName('');
    setChartDescription('');
    setChartComponentName('web');
    setChartComponentType('workload');
    setChartRepo('https://charts.bitnami.com/bitnami');
    setChartName('nginx');
    setChartVersion('21.0.7');
    setChartValuesJson('');
    setChartParams([]);
    setChartError(null);
  };

  const handleCreateFromChart = () => {
    const templateName = chartTemplateName.trim();
    const componentName = chartComponentName.trim();
    const repo = chartRepo.trim();
    const name = chartName.trim();
    const version = chartVersion.trim();

    if (!templateName || !componentName || !repo || !name || !version) {
      setChartError('Template name, component name, and chart repo/name/version are required.');
      return;
    }

    setChartError(null);

    let values: Record<string, unknown> | undefined;
    if (chartValuesJson.trim()) {
      try {
        const parsed = JSON.parse(chartValuesJson) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setChartError('Chart values must be a JSON object.');
          return;
        }
        values = parsed as Record<string, unknown>;
      } catch (err) {
        setChartError(err instanceof Error ? `Chart values JSON is invalid: ${err.message}` : 'Chart values JSON is invalid.');
        return;
      }
    }

    const parameters: Record<string, ChartParameterSpec> = {};
    for (const row of chartParams) {
      const key = row.key.trim();
      if (!key) continue;
      const component = row.component.trim() || componentName;
      const path = row.path.trim();
      if (!path) {
        setChartError(`Parameter "${key}" is missing its values path.`);
        return;
      }
      const param: ChartParameterSpec = {
        type: row.type,
        component,
        path,
        required: row.required,
      };
      const description = row.description.trim();
      if (description) param.description = description;
      const defaultValue = coerceDefaultValue(row.defaultValue, row.type);
      if (defaultValue !== undefined) param.default = defaultValue;
      if (row.generator) param.generator = row.generator;
      parameters[key] = param;
    }

    const payload: StackTemplateFromChart = {
      name: templateName,
      description: chartDescription.trim() || undefined,
      component_name: componentName,
      component_type: chartComponentType,
      chart: {
        repo,
        name,
        version,
      },
      values,
      parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    };

    createFromChartMutation.mutate(payload, {
      onSuccess: () => resetFromChartDialog(),
      onError: (err) => setChartError(err instanceof Error ? err.message : 'Failed to create template from chart'),
    });
  };

  if (!isAuthenticated) return null;

  return (
    <div className="px-8 py-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Stack Templates</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Browse, build, and deploy reusable stacks from apps, charts, and community sources.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFromAppDialog(true)} data-testid="open-from-app">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            From App
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFromChartDialog(true)} data-testid="open-from-chart">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            From Chart
          </Button>
          <Button size="sm" onClick={() => router.push('/settings/stack-templates/new')}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            From Scratch
          </Button>
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

      <Card className="border-zinc-200">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-700">Community Registry Source</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Point the catalog at a GitHub source descriptor ({'{'}type: &quot;github&quot;, repo, ref, path{'}'}) for read-only list and deploy.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="registry-repo">Repo (owner/name)</Label>
              <Input
                id="registry-repo"
                placeholder="kubenesthq/community-templates"
                value={registryDraftRepo}
                onChange={(e) => setRegistryDraftRepo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="registry-ref">Ref</Label>
              <Input
                id="registry-ref"
                placeholder="main"
                value={registryDraftRef}
                onChange={(e) => setRegistryDraftRef(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="registry-path">Path</Label>
              <Input
                id="registry-path"
                placeholder="templates"
                value={registryDraftPath}
                onChange={(e) => setRegistryDraftPath(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleApplyRegistrySource} data-testid="apply-registry-source">
              Apply Source
            </Button>
            <Button variant="ghost" size="sm" onClick={handleResetRegistrySource}>
              Use Default Source
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Active source: <span className="font-mono text-zinc-700">{registrySourceLabel}</span>
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Your Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card
                key={`${template.namespace}/${template.name}`}
                className="border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => router.push(`/settings/stack-templates/${template.namespace}/${template.name}`)}
              >
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
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/stacks/deploy?ns=${template.namespace}&name=${template.name}`);
                      }}
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
          <p className="text-xs text-zinc-400 mt-1">Build from an app, wrap a chart, or install from the community registry.</p>
        </div>
      ) : null}

      {registryLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Community Registry</h2>
          {filteredRegistry.length > 0 ? (
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
          ) : (
            <Card className="border-zinc-200">
              <CardContent className="pt-5 pb-5">
                <p className="text-sm text-zinc-500">No templates found for the active community source.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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

      <Dialog open={showFromAppDialog} onOpenChange={(open) => (open ? setShowFromAppDialog(true) : resetFromAppDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template from App</DialogTitle>
            <DialogDescription>
              Capture a running app’s component graph (including depends_on and export_ref wiring) into a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="from-app-project">Source Project</Label>
              <Select value={fromAppProjectId} onValueChange={(value) => { setFromAppProjectId(value); setFromAppSourceKey(''); }}>
                <SelectTrigger data-testid="from-app-project-select">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} ({project.namespace})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="from-app-source">Source App</Label>
              <Select value={fromAppSourceKey} onValueChange={setFromAppSourceKey} disabled={!fromAppProjectId || appsLoading}>
                <SelectTrigger data-testid="from-app-source-app-select">
                  <SelectValue placeholder={appsLoading ? 'Loading apps...' : 'Select an app...'} />
                </SelectTrigger>
                <SelectContent>
                  {appsForProject.map((app) => (
                    <SelectItem key={`${app.namespace}/${app.name}`} value={`${app.namespace}/${app.name}`}>
                      {app.name} ({app.namespace})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="from-app-name">Template Name</Label>
              <Input
                id="from-app-name"
                placeholder="my-captured-stack"
                value={fromAppName}
                onChange={(e) => setFromAppName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="from-app-description">Description</Label>
              <Textarea
                id="from-app-description"
                placeholder="Captured from a running app"
                rows={2}
                value={fromAppDescription}
                onChange={(e) => setFromAppDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={fromAppPreserveExportRefs}
                onChange={(e) => setFromAppPreserveExportRefs(e.target.checked)}
                className="rounded border-zinc-300"
              />
              Preserve export_ref links
            </label>
            {fromAppError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {fromAppError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetFromAppDialog} disabled={createFromAppMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFromApp}
              disabled={createFromAppMutation.isPending || !fromAppProjectId || !fromAppSourceKey || !fromAppName.trim()}
              data-testid="from-app-create-template"
            >
              {createFromAppMutation.isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFromChartDialog} onOpenChange={(open) => (open ? setShowFromChartDialog(true) : resetFromChartDialog())}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Template from Chart</DialogTitle>
            <DialogDescription>
              Wrap a Helm chart as a reusable template and expose selected values as deploy-time parameters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="chart-template-name">Template Name</Label>
                <Input
                  id="chart-template-name"
                  placeholder="nginx-stack"
                  value={chartTemplateName}
                  onChange={(e) => setChartTemplateName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="chart-template-desc">Description</Label>
                <Input
                  id="chart-template-desc"
                  placeholder="Template generated from a Helm chart"
                  value={chartDescription}
                  onChange={(e) => setChartDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="chart-component-name">Component Name</Label>
                <Input
                  id="chart-component-name"
                  placeholder="web"
                  value={chartComponentName}
                  onChange={(e) => {
                    const next = e.target.value;
                    setChartComponentName(next);
                    setChartParams((prev) =>
                      prev.map((row) =>
                        row.component.trim().length === 0 || row.component === chartComponentName
                          ? { ...row, component: next }
                          : row,
                      ),
                    );
                  }}
                />
              </div>
              <div>
                <Label htmlFor="chart-component-type">Component Type</Label>
                <Select value={chartComponentType} onValueChange={(value) => setChartComponentType(value as 'workload' | 'addon')}>
                  <SelectTrigger id="chart-component-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workload">workload</SelectItem>
                    <SelectItem value="addon">addon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="chart-repo">Chart Repo</Label>
                <Input
                  id="chart-repo"
                  placeholder="https://charts.bitnami.com/bitnami"
                  value={chartRepo}
                  onChange={(e) => setChartRepo(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label htmlFor="chart-name">Chart Name</Label>
                <Input
                  id="chart-name"
                  placeholder="nginx"
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label htmlFor="chart-version">Chart Version</Label>
                <Input
                  id="chart-version"
                  placeholder="21.0.7"
                  value={chartVersion}
                  onChange={(e) => setChartVersion(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="chart-values">Values JSON (optional)</Label>
              <Textarea
                id="chart-values"
                rows={6}
                placeholder={'{\n  "service": { "type": "ClusterIP" },\n  "replicaCount": 1\n}'}
                value={chartValuesJson}
                onChange={(e) => setChartValuesJson(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Deploy-time Parameters</Label>
                <Button type="button" variant="outline" size="sm" onClick={addChartParam}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Parameter
                </Button>
              </div>
              {chartParams.length > 0 ? (
                <div className="space-y-3">
                  {chartParams.map((row, index) => (
                    <Card key={`${index}-${row.key}`} className="border-zinc-200">
                      <CardContent className="pt-4 pb-4 space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <Label>Key</Label>
                            <Input
                              placeholder="db_storage"
                              value={row.key}
                              onChange={(e) => updateChartParam(index, { key: e.target.value })}
                              className="font-mono text-xs"
                            />
                          </div>
                          <div>
                            <Label>Type</Label>
                            <Select value={row.type} onValueChange={(value) => updateChartParam(index, { type: value as ChartParamType })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">string</SelectItem>
                                <SelectItem value="integer">integer</SelectItem>
                                <SelectItem value="boolean">boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Generator</Label>
                            <Select
                              value={row.generator || '_none'}
                              onValueChange={(value) =>
                                updateChartParam(index, { generator: parseChartParamGenerator(value) })
                              }
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">none</SelectItem>
                                <SelectItem value="random_hex_32">random_hex_32</SelectItem>
                                <SelectItem value="random_hex_16">random_hex_16</SelectItem>
                                <SelectItem value="random_password">random_password</SelectItem>
                                <SelectItem value="uuid">uuid</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <Label>Component</Label>
                            <Input
                              placeholder={chartComponentName || 'component'}
                              value={row.component}
                              onChange={(e) => updateChartParam(index, { component: e.target.value })}
                              className="font-mono text-xs"
                            />
                          </div>
                          <div>
                            <Label>Values Path</Label>
                            <Input
                              placeholder="service.type"
                              value={row.path}
                              onChange={(e) => updateChartParam(index, { path: e.target.value })}
                              className="font-mono text-xs"
                            />
                          </div>
                          <div>
                            <Label>Default</Label>
                            <Input
                              placeholder="ClusterIP"
                              value={row.defaultValue}
                              onChange={(e) => updateChartParam(index, { defaultValue: e.target.value })}
                              className="font-mono text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <Label>Description</Label>
                            <Input
                              placeholder="Service type for ingress exposure"
                              value={row.description}
                              onChange={(e) => updateChartParam(index, { description: e.target.value })}
                            />
                          </div>
                          <div className="flex items-end justify-between">
                            <label className="flex items-center gap-2 text-sm text-zinc-700">
                              <input
                                type="checkbox"
                                checked={row.required}
                                onChange={(e) => updateChartParam(index, { required: e.target.checked })}
                                className="rounded border-zinc-300"
                              />
                              Required
                            </label>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeChartParam(index)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No parameters configured. Deployers will use chart defaults unless overridden via values.</p>
              )}
            </div>

            {chartError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{chartError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetFromChartDialog} disabled={createFromChartMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFromChart}
              disabled={createFromChartMutation.isPending || !chartTemplateName.trim() || !chartComponentName.trim()}
              data-testid="from-chart-create-template"
            >
              {createFromChartMutation.isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!installTarget} onOpenChange={() => { setInstallTarget(null); setInstallNamespace(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Template</DialogTitle>
            <DialogDescription>
              Choose a namespace to install <strong>{installTarget}</strong> into from <span className="font-mono">{registrySourceLabel}</span>.
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
            <Button onClick={handleInstall} disabled={installMutation.isPending || !installNamespace.trim()}>
              {installMutation.isPending ? 'Installing...' : 'Install'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
