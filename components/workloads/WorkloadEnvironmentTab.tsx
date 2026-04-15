'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkloadSecretsCard } from '@/components/workloads/WorkloadSecretsCard';
import type { Workload } from '@/types/api';

interface Props {
  workload: Workload;
}

export function WorkloadEnvironmentTab({ workload }: Props) {
  const envVars = workload.env_config ?? [];

  return (
    <div className="space-y-6">
      <Card className="border-zinc-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-900">
            Environment variables
          </CardTitle>
        </CardHeader>
        <CardContent>
          {envVars.length > 0 ? (
            <div className="rounded-md border border-zinc-100 bg-zinc-50 divide-y divide-zinc-100">
              {envVars.map((env) => (
                <div
                  key={env.name}
                  className="flex items-center justify-between px-3 py-2 text-xs font-mono"
                >
                  <span className="text-zinc-700">
                    <span className="text-zinc-400">{env.name}=</span>
                    {env.value ?? (env.valueFrom ? '<from-secret>' : '')}
                  </span>
                  {env.valueFrom && (
                    <span className="rounded bg-zinc-200 text-zinc-600 px-1.5 py-0.5 uppercase tracking-wider text-[10px]">
                      ref
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              No environment variables. Inline add/edit coming in a follow-up bead.
            </p>
          )}
        </CardContent>
      </Card>

      <WorkloadSecretsCard workloadId={workload.id} />
    </div>
  );
}
