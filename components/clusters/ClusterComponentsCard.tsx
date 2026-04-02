'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ComponentSelector } from './ComponentSelector';
import { getClusterConfig, updateClusterConfig } from '@/api/clusters';
import type { ComponentsConfig } from '@/types/api';

interface ClusterComponentsCardProps {
  clusterId: string;
}

const defaultConfig: ComponentsConfig = {
  storage: false,
  ha: false,
  build: false,
  monitoring: { enabled: false },
};

export function ClusterComponentsCard({ clusterId }: ClusterComponentsCardProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ComponentsConfig>(defaultConfig);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['cluster-config', clusterId],
    queryFn: () => getClusterConfig(clusterId),
  });

  const mutation = useMutation({
    mutationFn: (newConfig: ComponentsConfig) => updateClusterConfig(clusterId, newConfig),
    onSuccess: (updated) => {
      queryClient.setQueryData(['cluster-config', clusterId], updated);
      setEditing(false);
      setSaveError(null);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    },
  });

  function startEditing() {
    setDraft(config ?? defaultConfig);
    setSaveError(null);
    setEditing(true);
  }

  const current = config ?? defaultConfig;
  const hasComponents = current.storage || current.ha || current.build || current.monitoring.enabled;

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
    <Card className="border-zinc-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-zinc-900">Platform Components</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Configure
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <ComponentSelector value={draft} onChange={setDraft} />

            {saveError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => mutation.mutate(draft)}
                disabled={mutation.isPending}
              >
                {mutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save
              </Button>
            </div>
          </div>
        ) : hasComponents ? (
          <div className="flex flex-wrap gap-2">
            {current.storage && (
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                Storage (Longhorn)
              </span>
            )}
            {current.ha && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                High Availability
              </span>
            )}
            {current.build && (
              <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
                Image Builds
              </span>
            )}
            {current.monitoring.enabled && (
              <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                Monitoring{current.monitoring.provider ? ` (${current.monitoring.provider})` : ''}
              </span>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center">
            <p className="text-sm text-zinc-400">No components configured. Click Configure to add storage, HA, builds, or monitoring.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
