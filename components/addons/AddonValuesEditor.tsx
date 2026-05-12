'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addonDefinitionsApi, addonInstancesApi } from '@/lib/api/addons';
import type { AddonInstance } from '@/types/api';
import { ExposedValuesForm } from './ExposedValuesForm';

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const cur = out[k];
    if (
      v && typeof v === 'object' && !Array.isArray(v) &&
      cur && typeof cur === 'object' && !Array.isArray(cur)
    ) {
      out[k] = deepMerge(cur as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Values tab — edit the addon instance's Helm values override and save the
 * change as a new revision (PATCH /addon-instances/{id}). When the instance was
 * created from a definition with `exposed_values`, the curated field form is
 * rendered prefilled from the live `chart_config.values`; otherwise (custom
 * chart, or no descriptor) a raw-JSON editor of the full override is shown.
 */
export function AddonValuesEditor({ instance }: { instance: AddonInstance }) {
  const queryClient = useQueryClient();
  const currentValues = useMemo<Record<string, unknown>>(() => {
    const cfg = instance.chart_config as Record<string, unknown> | null;
    const v = cfg?.values;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  }, [instance.chart_config]);

  const defQ = useQuery({
    queryKey: ['addon-definition', instance.definition_id],
    queryFn: () => addonDefinitionsApi.get(instance.definition_id as string),
    enabled: !!instance.definition_id,
  });
  const exposedValues = defQ.data?.exposed_values && Object.keys(defQ.data.exposed_values).length > 0
    ? defQ.data.exposed_values
    : null;

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [rawJson, setRawJson] = useState(() => JSON.stringify(currentValues, null, 2));
  const [note, setNote] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const patchMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      addonInstancesApi.patch(instance.id, { values, note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-instance', instance.id] });
      queryClient.invalidateQueries({ queryKey: ['addon-instance-revisions', instance.id] });
      setNote('');
    },
  });

  const save = () => {
    setJsonError(null);
    let nextValues: Record<string, unknown>;
    if (exposedValues) {
      nextValues = deepMerge(currentValues, formValues);
    } else {
      const text = rawJson.trim();
      if (!text) { nextValues = {}; }
      else {
        try {
          const parsed = JSON.parse(text);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            setJsonError('Values must be a JSON object.');
            return;
          }
          nextValues = parsed as Record<string, unknown>;
        } catch (e) {
          setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`);
          return;
        }
      }
    }
    patchMutation.mutate(nextValues);
  };

  const errMsg = patchMutation.error instanceof Error ? patchMutation.error.message : null;
  const formKey = `${instance.definition_id ?? 'custom'}:${instance.updated_at ?? instance.created_at}`;
  const loadingDef = !!instance.definition_id && defQ.isLoading;

  return (
    <Card className="border-zinc-200" data-testid="addon-values-editor">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-zinc-900">Helm values</CardTitle>
        <p className="text-sm text-zinc-500">
          Saving applies a Helm upgrade on the cluster and records a new revision (see the Versions tab).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingDef ? (
          <div className="py-6 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-zinc-400" /></div>
        ) : exposedValues ? (
          <ExposedValuesForm key={formKey} exposedValues={exposedValues} initialValues={currentValues} onChange={setFormValues} />
        ) : (
          <div>
            <Label htmlFor="addon-values-json" className="text-xs font-medium text-zinc-600 mb-1 block">
              Values override (JSON)
            </Label>
            <Textarea
              id="addon-values-json"
              data-testid="addon-values-json"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              className={`font-mono text-xs min-h-[180px] ${jsonError ? 'border-red-300' : ''}`}
            />
            {jsonError && <p className="text-xs text-red-500 mt-1" data-testid="addon-values-error">{jsonError}</p>}
          </div>
        )}

        <div>
          <Label htmlFor="addon-values-note" className="text-xs font-medium text-zinc-600 mb-1 block">
            Revision note (optional)
          </Label>
          <input
            id="addon-values-note"
            data-testid="addon-values-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. bump memory request"
            className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {errMsg && (
          <p className="text-sm text-red-600" data-testid="addon-values-submit-error">
            Failed to apply the values change: {errMsg}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={patchMutation.isPending} data-testid="addon-values-save">
            {patchMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Applying…</>
            ) : (
              'Save as a new revision'
            )}
          </Button>
          {patchMutation.isSuccess && !patchMutation.isPending && (
            <span className="text-sm text-emerald-600" data-testid="addon-values-saved">Helm upgrade dispatched — see the Versions tab.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
