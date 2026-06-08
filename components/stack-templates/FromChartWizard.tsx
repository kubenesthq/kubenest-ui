'use client';

/**
 * 3-step wizard for creating a chart-based stack template (kn-3nm).
 *
 * Step 1: chart coordinates + template metadata. The 'Inspect chart' button
 *   calls GET /stack-templates/inspect-chart (kn-d6v) and uses the response
 *   to seed step 2.
 * Step 2: parameter exposure. Schema-driven when the chart ships
 *   values.schema.json (rows are pre-populated from the schema's top-level
 *   properties, path read-only). Otherwise: manual editor, optionally
 *   seeded from values.yaml top-level keys.
 * Step 3: review + submit. POST /stack-templates/from-chart wraps the chart
 *   as a single-component stack template with the chosen parameters.
 */
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Layers, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCreateStackTemplateFromChart, useInspectChart } from '@/hooks/useStackTemplates';
import { ApiClientError } from '@/lib/api-client';
import type {
  ChartParameterSpec,
  InspectChartResponse,
  StackTemplateFromChart,
  StackTemplateRead,
} from '@/lib/api/stack-templates';

// -- Types --

type ParamType = ChartParameterSpec['type'];
type ParamGenerator = NonNullable<ChartParameterSpec['generator']> | '';

interface ParamRow {
  key: string;            // schema property name OR manual key (also used as the parameter key in the POST body)
  label: string;          // friendly label shown at deploy time
  path: string;           // dotted path into chart values (e.g. 'auth.password')
  type: ParamType;
  description: string;
  defaultValue: string;   // string buffer; coerced at submit
  required: boolean;
  generator: ParamGenerator;
  expose: boolean;        // checkbox 'Expose as parameter'
  fromSchema: boolean;    // schema-driven rows lock the `path` field
}

const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;

const GENERATOR_VALUES: ReadonlyArray<{ value: ParamGenerator | '_none'; label: string }> = [
  { value: '_none', label: 'none' },
  { value: 'random_password', label: 'random_password' },
  { value: 'random_hex_32', label: 'random_hex_32' },
  { value: 'random_hex_16', label: 'random_hex_16' },
  { value: 'uuid', label: 'uuid' },
];

function parseGenerator(raw: string): ParamGenerator {
  if (raw === '_none' || raw === '') return '';
  if (raw === 'random_password' || raw === 'random_hex_32' || raw === 'random_hex_16' || raw === 'uuid') return raw;
  return '';
}

// Sanitize a chart name into a DNS-label compatible component name.
// Bitnami charts already look like 'postgresql', 'nginx' which are valid,
// but we lowercase + replace anything non-alphanumeric with hyphens just
// in case. Trim hyphens at the edges.
function defaultComponentName(chartName: string): string {
  return chartName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

// Map a JSON-Schema 'type' down to one of the three types the backend's
// ChartParameterSpec accepts. Anything that isn't integer/boolean falls
// back to 'string' — strings carry the raw value through as-is.
function mapSchemaType(rawType: unknown): ParamType {
  if (rawType === 'integer' || rawType === 'number') return 'integer';
  if (rawType === 'boolean') return 'boolean';
  return 'string';
}

function stringifyDefault(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Objects/arrays — show as JSON; user can hand-edit if they really want
  // to expose a structured default.
  try { return JSON.stringify(value); } catch { return ''; }
}

// Coerce the buffered string back into the correct primitive at submit
// time. Returns undefined to mean 'no default', so the backend sees the
// chart's own default.
function coerceDefault(raw: string, type: ParamType): unknown {
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

// Walk the JSON Schema's top-level properties and build a row per property.
// Required properties default to expose=true; the rest start unchecked so
// the engineer opts in. Path == key for top-level.
function rowsFromSchema(schema: Record<string, unknown>): ParamRow[] {
  const propertiesRaw = schema.properties;
  if (!propertiesRaw || typeof propertiesRaw !== 'object') return [];
  const properties = propertiesRaw as Record<string, Record<string, unknown> | undefined>;
  const requiredList = Array.isArray(schema.required)
    ? schema.required.filter((v): v is string => typeof v === 'string')
    : [];
  const requiredSet = new Set(requiredList);

  return Object.entries(properties).map(([key, prop]) => {
    const description = typeof prop?.description === 'string' ? prop.description : '';
    const type = mapSchemaType(prop?.type);
    const isRequired = requiredSet.has(key);
    return {
      key,
      label: typeof prop?.title === 'string' ? prop.title : key,
      path: key,
      type,
      description,
      defaultValue: stringifyDefault(prop?.default),
      required: isRequired,
      generator: '',
      expose: isRequired,
      fromSchema: true,
    } satisfies ParamRow;
  });
}

// For schema-less charts, seed rows from the top-level keys of values.yaml.
// Type is inferred from the primitive type of the default. Objects/arrays
// become string rows with a JSON default — the engineer can refine paths
// manually.
function rowsFromDefaults(defaults: Record<string, unknown>): ParamRow[] {
  return Object.entries(defaults).map(([key, value]) => {
    let type: ParamType = 'string';
    if (typeof value === 'boolean') type = 'boolean';
    else if (typeof value === 'number' && Number.isInteger(value)) type = 'integer';
    return {
      key,
      label: key,
      path: key,
      type,
      description: '',
      defaultValue: stringifyDefault(value),
      required: false,
      generator: '',
      expose: false,
      fromSchema: false,
    } satisfies ParamRow;
  });
}

function emptyRow(): ParamRow {
  return {
    key: '',
    label: '',
    path: '',
    type: 'string',
    description: '',
    defaultValue: '',
    required: false,
    generator: '',
    expose: true,
    fromSchema: false,
  };
}

function inspectErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const detail = error.detail as Record<string, unknown> | null;
    const detailMessage = detail && typeof detail.message === 'string' ? detail.message : undefined;
    return detailMessage ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to inspect chart';
}

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 409) return 'A template with that name already exists in your org.';
    const detail = error.detail as Record<string, unknown> | null;
    const detailMessage = detail && typeof detail.message === 'string' ? detail.message : undefined;
    return detailMessage ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to create template';
}

// -- Component --

interface FromChartWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (template: StackTemplateRead) => void;
}

export function FromChartWizard({ open, onClose, onSuccess }: FromChartWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: chart source + template metadata.
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateVersion, setTemplateVersion] = useState('1.0.0');
  const [componentType, setComponentType] = useState<'workload' | 'addon'>('workload');
  const [chartRepo, setChartRepo] = useState('https://charts.bitnami.com/bitnami');
  const [chartName, setChartName] = useState('');
  const [chartVersion, setChartVersion] = useState('');

  // Inspection result + step 2 rows.
  const [inspection, setInspection] = useState<InspectChartResponse | null>(null);
  const [params, setParams] = useState<ParamRow[]>([]);

  const [error, setError] = useState<string | null>(null);

  const inspectMutation = useInspectChart();
  const createMutation = useCreateStackTemplateFromChart();

  const reset = () => {
    setStep(1);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateVersion('1.0.0');
    setComponentType('workload');
    setChartRepo('https://charts.bitnami.com/bitnami');
    setChartName('');
    setChartVersion('');
    setInspection(null);
    setParams([]);
    setError(null);
    inspectMutation.reset();
    createMutation.reset();
  };

  const close = () => {
    if (createMutation.isPending) return;
    reset();
    onClose();
  };

  // -- Step 1 validation --

  const trimmedTemplateName = templateName.trim();
  const trimmedTemplateVersion = templateVersion.trim() || '1.0.0';
  const trimmedChartRepo = chartRepo.trim();
  const trimmedChartName = chartName.trim();
  const trimmedChartVersion = chartVersion.trim();

  const templateNameInvalid = trimmedTemplateName.length > 0 && !k8sNameRegex.test(trimmedTemplateName);
  const templateVersionInvalid = templateVersion.length > 0 && !SEMVER_REGEX.test(trimmedTemplateVersion);

  const step1Complete =
    trimmedTemplateName.length > 0 && !templateNameInvalid && !templateVersionInvalid &&
    trimmedChartRepo.length > 0 && trimmedChartName.length > 0 && trimmedChartVersion.length > 0;

  // -- Step 1 actions --

  const handleInspect = async () => {
    setError(null);
    if (!step1Complete) {
      setError('Fill in template name, chart repo, chart name, and version before inspecting.');
      return;
    }
    try {
      const result = await inspectMutation.mutateAsync({
        repo: trimmedChartRepo,
        name: trimmedChartName,
        version: trimmedChartVersion,
      });
      setInspection(result);
      const seeded = result.has_schema && result.schema
        ? rowsFromSchema(result.schema)
        : rowsFromDefaults(result.defaults);
      setParams(seeded);
      setStep(2);
    } catch (err) {
      setError(inspectErrorMessage(err));
    }
  };

  // Bypass inspection and go straight to a manual editor. Useful if the
  // inspect endpoint is down or the chart sits behind auth.
  const handleSkipInspect = () => {
    setError(null);
    if (!step1Complete) {
      setError('Fill in template name, chart repo, chart name, and version before continuing.');
      return;
    }
    setInspection(null);
    setParams([emptyRow()]);
    setStep(2);
  };

  // -- Step 2 actions --

  const updateRow = (index: number, patch: Partial<ParamRow>) => {
    setParams((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setParams((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setParams((prev) => prev.filter((_, idx) => idx !== index));

  // -- Step 3 / submit --

  const exposedRows = useMemo(() => params.filter((r) => r.expose && r.key.trim().length > 0), [params]);

  const handleSubmit = async () => {
    setError(null);

    const parameters: Record<string, ChartParameterSpec> = {};
    const componentName = defaultComponentName(trimmedChartName) || 'chart';

    for (const row of exposedRows) {
      const key = row.key.trim();
      const path = row.path.trim();
      if (!path) {
        setError(`Parameter "${key}" needs a values path.`);
        return;
      }
      const param: ChartParameterSpec = {
        type: row.type,
        component: componentName,
        path,
        required: row.required,
      };
      const description = row.description.trim();
      if (description) param.description = description;
      const def = coerceDefault(row.defaultValue, row.type);
      if (def !== undefined) param.default = def;
      if (row.generator) param.generator = row.generator;
      parameters[key] = param;
    }

    const payload: StackTemplateFromChart = {
      name: trimmedTemplateName,
      version: trimmedTemplateVersion,
      component_name: componentName,
      component_type: componentType,
      chart: {
        repo: trimmedChartRepo,
        name: trimmedChartName,
        version: trimmedChartVersion,
      },
    };
    const desc = templateDescription.trim();
    if (desc) payload.description = desc;
    if (Object.keys(parameters).length > 0) payload.parameters = parameters;

    try {
      const created = await createMutation.mutateAsync(payload);
      onSuccess?.(created);
      close();
    } catch (err) {
      setError(submitErrorMessage(err));
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) close();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-500" />
            Create template from chart
          </DialogTitle>
          <DialogDescription>
            Wrap a Helm chart as a reusable stack template. The wizard inspects the chart, lets you
            pick which values to expose as deploy-time parameters, and saves the result.
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} />

        {step === 1 && (
          <Step1Source
            templateName={templateName}
            setTemplateName={setTemplateName}
            templateDescription={templateDescription}
            setTemplateDescription={setTemplateDescription}
            templateVersion={templateVersion}
            setTemplateVersion={setTemplateVersion}
            componentType={componentType}
            setComponentType={setComponentType}
            chartRepo={chartRepo}
            setChartRepo={setChartRepo}
            chartName={chartName}
            setChartName={setChartName}
            chartVersion={chartVersion}
            setChartVersion={setChartVersion}
            templateNameInvalid={templateNameInvalid}
            templateVersionInvalid={templateVersionInvalid}
          />
        )}

        {step === 2 && (
          <Step2Parameters
            inspection={inspection}
            params={params}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
          />
        )}

        {step === 3 && (
          <Step3Review
            templateName={trimmedTemplateName}
            templateDescription={templateDescription.trim()}
            templateVersion={trimmedTemplateVersion}
            componentType={componentType}
            chartRepo={trimmedChartRepo}
            chartName={trimmedChartName}
            chartVersion={trimmedChartVersion}
            componentName={defaultComponentName(trimmedChartName) || 'chart'}
            exposedRows={exposedRows}
          />
        )}

        {error && (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2"
            data-testid="from-chart-wizard-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                disabled={createMutation.isPending}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={close} disabled={createMutation.isPending}>
              Cancel
            </Button>
            {step === 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkipInspect}
                  disabled={!step1Complete || inspectMutation.isPending}
                >
                  Skip & define manually
                </Button>
                <Button
                  size="sm"
                  onClick={handleInspect}
                  disabled={!step1Complete || inspectMutation.isPending}
                  data-testid="from-chart-wizard-inspect"
                >
                  {inspectMutation.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Inspecting…</>
                  ) : (
                    <><Search className="h-3.5 w-3.5 mr-1.5" /> Inspect chart</>
                  )}
                </Button>
              </>
            )}
            {step === 2 && (
              <Button size="sm" onClick={() => setStep(3)} data-testid="from-chart-wizard-next">
                Review <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
            {step === 3 && (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                data-testid="from-chart-wizard-save"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
                ) : (
                  <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Save template</>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -- Sub-components --

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const labels: Array<{ n: 1 | 2 | 3; label: string }> = [
    { n: 1, label: 'Chart source' },
    { n: 2, label: 'Parameters' },
    { n: 3, label: 'Review' },
  ];
  return (
    <div className="flex items-center gap-2 text-xs">
      {labels.map(({ n, label }, idx) => {
        const active = step === n;
        const done = step > n;
        return (
          <div key={n} className="flex items-center gap-2">
            <span
              className={
                'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold ' +
                (active
                  ? 'bg-violet-500 text-white'
                  : done
                    ? 'bg-violet-200 text-violet-700'
                    : 'bg-zinc-200 text-zinc-500')
              }
            >
              {n}
            </span>
            <span className={active ? 'font-medium text-zinc-900' : 'text-zinc-500'}>{label}</span>
            {idx < labels.length - 1 && <span className="text-zinc-300">/</span>}
          </div>
        );
      })}
    </div>
  );
}

function Step1Source(props: {
  templateName: string;
  setTemplateName: (v: string) => void;
  templateDescription: string;
  setTemplateDescription: (v: string) => void;
  templateVersion: string;
  setTemplateVersion: (v: string) => void;
  componentType: 'workload' | 'addon';
  setComponentType: (v: 'workload' | 'addon') => void;
  chartRepo: string;
  setChartRepo: (v: string) => void;
  chartName: string;
  setChartName: (v: string) => void;
  chartVersion: string;
  setChartVersion: (v: string) => void;
  templateNameInvalid: boolean;
  templateVersionInvalid: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="from-chart-template-name">Template name</Label>
          <Input
            id="from-chart-template-name"
            placeholder="my-postgres-stack"
            value={props.templateName}
            onChange={(e) => props.setTemplateName(e.target.value)}
            data-testid="from-chart-wizard-template-name"
          />
          {props.templateNameInvalid && (
            <p className="text-xs text-red-600 mt-1">Lowercase letters, numbers, and hyphens only.</p>
          )}
        </div>
        <div>
          <Label htmlFor="from-chart-template-version">Version</Label>
          <Input
            id="from-chart-template-version"
            placeholder="1.0.0"
            value={props.templateVersion}
            onChange={(e) => props.setTemplateVersion(e.target.value)}
            className="font-mono text-xs"
          />
          {props.templateVersionInvalid && (
            <p className="text-xs text-red-600 mt-1">Semver, e.g. 1.0.0.</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="from-chart-template-description">Description (optional)</Label>
        <Textarea
          id="from-chart-template-description"
          placeholder="Postgres with persistence and a default password generator"
          value={props.templateDescription}
          onChange={(e) => props.setTemplateDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="from-chart-repo">Chart repository URL</Label>
          <Input
            id="from-chart-repo"
            placeholder="https://charts.bitnami.com/bitnami"
            value={props.chartRepo}
            onChange={(e) => props.setChartRepo(e.target.value)}
            className="font-mono text-xs"
            data-testid="from-chart-wizard-chart-repo"
          />
        </div>
        <div>
          <Label htmlFor="from-chart-name">Chart name</Label>
          <Input
            id="from-chart-name"
            placeholder="postgresql"
            value={props.chartName}
            onChange={(e) => props.setChartName(e.target.value)}
            className="font-mono text-xs"
            data-testid="from-chart-wizard-chart-name"
          />
        </div>
        <div>
          <Label htmlFor="from-chart-version">Chart version</Label>
          <Input
            id="from-chart-version"
            placeholder="15.5.0"
            value={props.chartVersion}
            onChange={(e) => props.setChartVersion(e.target.value)}
            className="font-mono text-xs"
            data-testid="from-chart-wizard-chart-version"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="from-chart-component-type">Component type</Label>
        <Select value={props.componentType} onValueChange={(v) => props.setComponentType(v as 'workload' | 'addon')}>
          <SelectTrigger id="from-chart-component-type" className="md:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="workload">workload</SelectItem>
            <SelectItem value="addon">addon</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-zinc-500 mt-1">
          How the wrapped chart appears in apps. Most charts are workloads; pick &lsquo;addon&rsquo; for
          shared services like databases or caches.
        </p>
      </div>

      <p className="text-xs text-zinc-500">
        Only http(s) chart repos are supported in v1. OCI registries are not yet inspected.
      </p>
    </div>
  );
}

function Step2Parameters({
  inspection,
  params,
  updateRow,
  addRow,
  removeRow,
}: {
  inspection: InspectChartResponse | null;
  params: ParamRow[];
  updateRow: (index: number, patch: Partial<ParamRow>) => void;
  addRow: () => void;
  removeRow: (index: number) => void;
}) {
  const hasSchema = inspection?.has_schema === true;
  return (
    <div className="space-y-4">
      {inspection && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 space-y-1">
          <div>
            <span className="font-semibold">{inspection.chart_metadata.name}</span>
            <span className="font-mono"> @ {inspection.chart_metadata.version}</span>
          </div>
          {inspection.chart_metadata.description && (
            <p className="text-zinc-500">{inspection.chart_metadata.description}</p>
          )}
          {hasSchema ? (
            <p className="text-violet-600">
              <CheckCircle2 className="h-3 w-3 inline mr-1" />
              Schema detected — parameters pre-populated from values.schema.json. Tick the rows you want to expose.
            </p>
          ) : (
            <p className="text-amber-700">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              This chart has no values schema. Parameters are seeded from values.yaml top-level keys —
              edit paths and add rows as needed.
            </p>
          )}
          {inspection.schema_warning && (
            <p className="text-amber-700">Schema warning: {inspection.schema_warning}</p>
          )}
        </div>
      )}

      {!inspection && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Inspection was skipped. Define parameters manually — each row needs at minimum a key and a values path.
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label>Parameters</Label>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add row
        </Button>
      </div>

      {params.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No parameters yet. Click &lsquo;Add row&rsquo; to expose a chart value, or go back to inspect the chart.
        </p>
      ) : (
        <div className="space-y-2">
          {params.map((row, index) => (
            <ParamRowEditor
              key={index}
              row={row}
              onChange={(patch) => updateRow(index, patch)}
              onRemove={() => removeRow(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ParamRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: ParamRow;
  onChange: (patch: Partial<ParamRow>) => void;
  onRemove: () => void;
}) {
  return (
    <Card className="border-zinc-200">
      <CardContent className="pt-3 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={row.expose}
              onChange={(e) => onChange({ expose: e.target.checked })}
              className="rounded border-zinc-300"
              data-testid="from-chart-wizard-row-expose"
            />
            <span className="font-medium">Expose as parameter</span>
            {row.fromSchema && <Badge variant="outline" className="text-[10px] font-normal">from schema</Badge>}
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 px-2">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <Label className="text-[11px]">Key</Label>
            <Input
              placeholder="postgres_password"
              value={row.key}
              onChange={(e) => onChange({ key: e.target.value })}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px]">Label</Label>
            <Input
              placeholder="Postgres password"
              value={row.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px]">Type</Label>
            <Select value={row.type} onValueChange={(v) => onChange({ type: v as ParamType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="string">string</SelectItem>
                <SelectItem value="integer">integer</SelectItem>
                <SelectItem value="boolean">boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <Label className="text-[11px]">Values path</Label>
            <Input
              placeholder="auth.password"
              value={row.path}
              onChange={(e) => onChange({ path: e.target.value })}
              readOnly={row.fromSchema}
              className={
                'font-mono text-xs ' + (row.fromSchema ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : '')
              }
            />
          </div>
          <div>
            <Label className="text-[11px]">Default</Label>
            <Input
              placeholder=""
              value={row.defaultValue}
              onChange={(e) => onChange({ defaultValue: e.target.value })}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px]">Generator</Label>
            <Select
              value={row.generator === '' ? '_none' : row.generator}
              onValueChange={(v) => onChange({ generator: parseGenerator(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GENERATOR_VALUES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <Label className="text-[11px]">Description</Label>
            <Input
              placeholder="What this parameter controls"
              value={row.description}
              onChange={(e) => onChange({ description: e.target.value })}
              className="text-xs"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={row.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="rounded border-zinc-300"
              />
              Required at deploy time
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Step3Review({
  templateName,
  templateDescription,
  templateVersion,
  componentType,
  chartRepo,
  chartName,
  chartVersion,
  componentName,
  exposedRows,
}: {
  templateName: string;
  templateDescription: string;
  templateVersion: string;
  componentType: 'workload' | 'addon';
  chartRepo: string;
  chartName: string;
  chartVersion: string;
  componentName: string;
  exposedRows: ParamRow[];
}) {
  return (
    <div className="space-y-4">
      <Card className="border-zinc-200">
        <CardContent className="pt-4 pb-4 space-y-2">
          <h3 className="text-sm font-medium text-zinc-900">Template</h3>
          <dl className="grid grid-cols-3 gap-y-1 text-xs">
            <dt className="text-zinc-500">Name</dt>
            <dd className="col-span-2 font-mono text-zinc-900">{templateName}</dd>
            <dt className="text-zinc-500">Version</dt>
            <dd className="col-span-2 font-mono text-zinc-900">{templateVersion}</dd>
            {templateDescription && (
              <>
                <dt className="text-zinc-500">Description</dt>
                <dd className="col-span-2 text-zinc-900">{templateDescription}</dd>
              </>
            )}
            <dt className="text-zinc-500">Component</dt>
            <dd className="col-span-2 font-mono text-zinc-900">{componentName} ({componentType})</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-zinc-200">
        <CardContent className="pt-4 pb-4 space-y-2">
          <h3 className="text-sm font-medium text-zinc-900 flex items-center gap-2">
            Helm chart <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-[10px] font-normal">chart</Badge>
          </h3>
          <dl className="grid grid-cols-3 gap-y-1 text-xs">
            <dt className="text-zinc-500">Repository</dt>
            <dd className="col-span-2 font-mono text-zinc-900 break-all">{chartRepo}</dd>
            <dt className="text-zinc-500">Chart</dt>
            <dd className="col-span-2 font-mono text-zinc-900">{chartName} @ {chartVersion}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-zinc-200">
        <CardContent className="pt-4 pb-4 space-y-2">
          <h3 className="text-sm font-medium text-zinc-900">
            Parameters <span className="text-zinc-400 font-normal">({exposedRows.length})</span>
          </h3>
          {exposedRows.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No parameters exposed. Deployers will get the chart&apos;s default values.
            </p>
          ) : (
            <div className="rounded-md border border-zinc-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Key</th>
                    <th className="text-left px-2 py-1 font-medium">Path</th>
                    <th className="text-left px-2 py-1 font-medium">Type</th>
                    <th className="text-left px-2 py-1 font-medium">Default</th>
                    <th className="text-left px-2 py-1 font-medium">Required</th>
                    <th className="text-left px-2 py-1 font-medium">Generator</th>
                  </tr>
                </thead>
                <tbody>
                  {exposedRows.map((row, idx) => (
                    <tr key={`${row.key}-${idx}`} className="border-t border-zinc-100">
                      <td className="px-2 py-1 font-mono">{row.key}</td>
                      <td className="px-2 py-1 font-mono">{row.path}</td>
                      <td className="px-2 py-1">{row.type}</td>
                      <td className="px-2 py-1 font-mono">{row.defaultValue || <span className="text-zinc-400">—</span>}</td>
                      <td className="px-2 py-1">{row.required ? 'yes' : 'no'}</td>
                      <td className="px-2 py-1 font-mono">{row.generator || <span className="text-zinc-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
