'use client';

import { Check, HardDrive, Shield, Hammer, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComponentsConfig, MonitoringConfig } from '@/types/api';

const COMPONENTS = [
  {
    key: 'storage' as const,
    label: 'Persistent Storage',
    description: 'Install Longhorn for replicated block storage and persistent volumes.',
    icon: HardDrive,
    color: 'blue',
  },
  {
    key: 'ha' as const,
    label: 'High Availability',
    description: 'Multi-node control plane with 3+ masters for fault tolerance.',
    icon: Shield,
    color: 'emerald',
  },
  {
    key: 'build' as const,
    label: 'Image Builds',
    description: 'Build container images from git source directly in the cluster.',
    icon: Hammer,
    color: 'orange',
  },
];

const MONITORING_PROVIDERS = [
  { value: 'grafana-cloud', label: 'Grafana Cloud' },
  { value: 'self-hosted', label: 'Self-hosted (provide endpoint)' },
  { value: 'kubenest-managed', label: 'KubeNest Managed' },
];

interface ComponentSelectorProps {
  value: ComponentsConfig;
  onChange: (config: ComponentsConfig) => void;
}

export function ComponentSelector({ value, onChange }: ComponentSelectorProps) {
  function toggleComponent(key: 'storage' | 'ha' | 'build') {
    onChange({ ...value, [key]: !value[key] });
  }

  function toggleMonitoring() {
    onChange({
      ...value,
      monitoring: {
        ...value.monitoring,
        enabled: !value.monitoring.enabled,
      },
    });
  }

  function updateMonitoring(updates: Partial<MonitoringConfig>) {
    onChange({
      ...value,
      monitoring: { ...value.monitoring, ...updates },
    });
  }

  return (
    <div className="space-y-3">
      {COMPONENTS.map((comp) => {
        const active = value[comp.key];
        const Icon = comp.icon;
        const bgClass = comp.color === 'blue' ? 'bg-blue-100' :
          comp.color === 'emerald' ? 'bg-emerald-100' : 'bg-orange-100';
        const iconClass = comp.color === 'blue' ? 'text-blue-600' :
          comp.color === 'emerald' ? 'text-emerald-600' : 'text-orange-600';

        return (
          <button
            key={comp.key}
            type="button"
            onClick={() => toggleComponent(comp.key)}
            className={cn(
              'w-full text-left rounded-lg border p-4 transition-colors',
              active ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', bgClass)}>
                  <Icon className={cn('h-4 w-4', iconClass)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">{comp.label}</p>
                  <p className="text-xs text-zinc-400">{comp.description}</p>
                </div>
              </div>
              {active && (
                <div className="h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Monitoring — special card with expandable config */}
      <button
        type="button"
        onClick={toggleMonitoring}
        className={cn(
          'w-full text-left rounded-lg border p-4 transition-colors',
          value.monitoring.enabled ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900">Monitoring</p>
              <p className="text-xs text-zinc-400">
                Ship metrics to an external Grafana/Prometheus backend via remote-write.
              </p>
            </div>
          </div>
          {value.monitoring.enabled && (
            <div className="h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </button>

      {/* Monitoring config (shown when enabled) */}
      {value.monitoring.enabled && (
        <div className="ml-12 space-y-3 border-l-2 border-zinc-200 pl-4" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-600">Provider</Label>
            <div className="flex flex-wrap gap-2">
              {MONITORING_PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => updateMonitoring({ provider: p.value })}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs border transition-colors',
                    value.monitoring.provider === p.value
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {value.monitoring.provider && value.monitoring.provider !== 'kubenest-managed' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Remote Write URL</Label>
                <Input
                  placeholder="https://prometheus-prod.grafana.net/api/prom/push"
                  className="border-zinc-200 text-xs"
                  value={value.monitoring.remote_write_url ?? ''}
                  onChange={(e) => updateMonitoring({ remote_write_url: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Credentials Secret Name</Label>
                <Input
                  placeholder="monitoring-creds"
                  className="border-zinc-200 text-xs"
                  value={value.monitoring.credentials_secret ?? ''}
                  onChange={(e) => updateMonitoring({ credentials_secret: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="text-xs text-zinc-400">K8s secret with your monitoring provider API key</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
