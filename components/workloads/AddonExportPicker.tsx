'use client';

import { useState } from 'react';
import { Database, Link2, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAvailableExports } from '@/hooks/useWorkloads';
import type { EnvVarInput } from '@/types/api';
import type { AvailableExport } from '@/lib/api/workloads';

interface AddonExportPickerProps {
  projectId: string;
  value: EnvVarInput[];
  onChange: (envVars: EnvVarInput[]) => void;
}

export function AddonExportPicker({ projectId, value, onChange }: AddonExportPickerProps) {
  const { data: exports, isLoading } = useAvailableExports(projectId);
  const [showPicker, setShowPicker] = useState(false);

  const availableExports = exports ?? [];

  const addExportBinding = (exp: AvailableExport) => {
    const exists = value.some(
      (v) =>
        v.export_ref?.addon_instance_id === exp.addon_instance_id &&
        v.export_ref?.export_key === exp.export_key
    );
    if (exists) return;

    onChange([
      ...value,
      {
        name: exp.env_var_suggestion,
        export_ref: {
          addon_instance_id: exp.addon_instance_id,
          export_key: exp.export_key,
        },
      },
    ]);
  };

  const addStaticVar = () => {
    onChange([...value, { name: '', value: '' }]);
  };

  const updateVar = (idx: number, updates: Partial<EnvVarInput>) => {
    const updated = [...value];
    updated[idx] = { ...updated[idx], ...updates };
    onChange(updated);
  };

  const removeVar = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const updateEnvName = (idx: number, name: string) => {
    updateVar(idx, { name });
  };

  // Group available exports by addon
  const exportsByAddon = availableExports.reduce<Record<string, AvailableExport[]>>((acc, exp) => {
    const key = `${exp.addon_name} (${exp.addon_type})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(exp);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-zinc-700">Environment Variables</Label>
        <div className="flex gap-2">
          {availableExports.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPicker(!showPicker)}
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Wire Addon
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addStaticVar}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Variable
          </Button>
        </div>
      </div>

      {/* Addon export picker dropdown */}
      {showPicker && (
        <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 space-y-2">
          <p className="text-xs text-zinc-500 font-medium">Select an addon export to wire:</p>
          {isLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              <span className="text-xs text-zinc-400">Loading exports...</span>
            </div>
          ) : Object.entries(exportsByAddon).length > 0 ? (
            Object.entries(exportsByAddon).map(([addonLabel, addonExports]) => (
              <div key={addonLabel}>
                <p className="text-xs font-medium text-zinc-600 mb-1">
                  <Database className="h-3 w-3 inline mr-1" />
                  {addonLabel}
                </p>
                <div className="flex flex-wrap gap-1">
                  {addonExports.map((exp) => {
                    const alreadyWired = value.some(
                      (v) =>
                        v.export_ref?.addon_instance_id === exp.addon_instance_id &&
                        v.export_ref?.export_key === exp.export_key
                    );
                    return (
                      <Button
                        key={`${exp.addon_instance_id}-${exp.export_key}`}
                        type="button"
                        variant={alreadyWired ? 'secondary' : 'outline'}
                        size="sm"
                        className="text-xs"
                        disabled={alreadyWired}
                        onClick={() => addExportBinding(exp)}
                      >
                        {exp.export_key}
                        {alreadyWired && ' (wired)'}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-400">No addon exports available in this project.</p>
          )}
        </div>
      )}

      {/* Env var list */}
      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((envVar, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  placeholder="ENV_NAME"
                  value={envVar.name}
                  onChange={(e) => updateEnvName(idx, e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex-1">
                {envVar.export_ref ? (
                  <div className="h-9 flex items-center px-3 border border-zinc-200 rounded-md bg-zinc-50">
                    <Badge variant="secondary" className="text-xs">
                      <Link2 className="h-3 w-3 mr-1" />
                      {envVar.export_ref.export_key}
                    </Badge>
                  </div>
                ) : (
                  <Input
                    placeholder="value"
                    value={envVar.value ?? ''}
                    onChange={(e) => updateVar(idx, { value: e.target.value })}
                    className="font-mono text-sm"
                  />
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-zinc-400 hover:text-red-500"
                onClick={() => removeVar(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400">No environment variables configured.</p>
      )}
    </div>
  );
}
