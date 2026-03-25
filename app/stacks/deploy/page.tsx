'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import {
  getDemoStackTemplate,
  deployDemoStack,
  type DemoStackTemplate,
} from '@/lib/demo-store';


const builtinTemplateData: Record<string, { name: string; components: string[]; image: string; addons: string[]; variables: { key: string; label: string; default: string; description: string }[] }> = {
  'node-postgres': {
    name: 'Node.js + PostgreSQL',
    components: ['Node.js App', 'PostgreSQL'],
    image: 'node:20',
    addons: ['PostgreSQL'],
    variables: [
      { key: 'app_name', label: 'Application Name', default: 'my-app', description: 'Used for service names and database' },
      { key: 'node_version', label: 'Node.js Version', default: '20', description: 'Node.js major version' },
      { key: 'db_name', label: 'Database Name', default: 'myapp', description: 'PostgreSQL database name' },
      { key: 'db_storage', label: 'Database Storage', default: '5Gi', description: 'Persistent volume size' },
    ],
  },
  'rails-redis-postgres': {
    name: 'Rails + Redis + PostgreSQL',
    components: ['Rails App', 'PostgreSQL', 'Redis'],
    image: 'ruby:3.3',
    addons: ['PostgreSQL', 'Redis'],
    variables: [
      { key: 'app_name', label: 'Application Name', default: 'my-rails-app', description: 'Used for service names' },
      { key: 'ruby_version', label: 'Ruby Version', default: '3.3', description: 'Ruby version' },
      { key: 'db_name', label: 'Database Name', default: 'rails_production', description: 'PostgreSQL database name' },
      { key: 'redis_memory', label: 'Redis Memory', default: '128Mi', description: 'Memory for Redis cache' },
      { key: 'worker_replicas', label: 'Sidekiq Workers', default: '2', description: 'Number of background job workers' },
    ],
  },
  'nextjs-postgres': {
    name: 'Next.js + PostgreSQL',
    components: ['Next.js App', 'PostgreSQL'],
    image: 'node:20',
    addons: ['PostgreSQL'],
    variables: [
      { key: 'app_name', label: 'Application Name', default: 'my-nextjs-app', description: 'Application name' },
      { key: 'db_name', label: 'Database Name', default: 'nextjs_db', description: 'PostgreSQL database name' },
    ],
  },
  'django-postgres': {
    name: 'Django + PostgreSQL',
    components: ['Django App', 'PostgreSQL', 'Redis', 'Celery Worker'],
    image: 'python:3.12',
    addons: ['PostgreSQL', 'Redis'],
    variables: [
      { key: 'app_name', label: 'Application Name', default: 'my-django-app', description: 'Application name' },
      { key: 'db_name', label: 'Database Name', default: 'django_db', description: 'PostgreSQL database name' },
    ],
  },
  'fastapi-postgres': {
    name: 'FastAPI + PostgreSQL',
    components: ['FastAPI App', 'PostgreSQL'],
    image: 'python:3.12',
    addons: ['PostgreSQL'],
    variables: [
      { key: 'app_name', label: 'Application Name', default: 'my-fastapi-app', description: 'Application name' },
      { key: 'db_name', label: 'Database Name', default: 'fastapi_db', description: 'PostgreSQL database name' },
    ],
  },
  'kafka-stream': {
    name: 'Event Streaming Pipeline',
    components: ['Kafka', 'Producer Service', 'Consumer Service'],
    image: 'bitnami/kafka:3.7',
    addons: ['Kafka'],
    variables: [
      { key: 'app_name', label: 'Pipeline Name', default: 'my-pipeline', description: 'Pipeline name' },
      { key: 'partitions', label: 'Partitions', default: '3', description: 'Number of Kafka partitions' },
    ],
  },
};

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
  const templateId = searchParams.get('template') || '';

  const [userTemplate, setUserTemplate] = useState<DemoStackTemplate | null>(null);

  useEffect(() => {
    // Check if it's a user-created template (UUID format)
    if (templateId && !builtinTemplateData[templateId]) {
      setUserTemplate(getDemoStackTemplate(templateId));
    }
  }, [templateId]);

  // Resolve template data
  const builtinTpl = builtinTemplateData[templateId];
  const resolvedName = userTemplate?.name ?? builtinTpl?.name ?? 'Custom Stack';
  const resolvedComponents = userTemplate
    ? [userTemplate.workload_config.name, ...userTemplate.addons.map(a => a.addon_name)]
    : builtinTpl?.components ?? ['App'];
  const resolvedVariables = userTemplate
    ? userTemplate.variables.map(v => ({ key: v.key, label: v.label, default: v.default_value, description: v.description }))
    : builtinTpl?.variables ?? [
        { key: 'app_name', label: 'Application Name', default: 'my-app', description: 'Application name' },
        { key: 'replicas', label: 'Replicas', default: '1', description: 'Number of replicas' },
      ];

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(resolvedVariables.map((v) => [v.key, v.default]))
  );
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const handleDeploy = () => {
    setDeploying(true);

    // Save to localStorage as a deployed stack
    const stackName = values.app_name || resolvedName;
    deployDemoStack({
      name: stackName,
      template_id: userTemplate?.id ?? templateId ?? null,
      template_name: resolvedName,
      project_id: 'demo', // placeholder project
      workload_name: userTemplate?.workload_config.name ?? values.app_name ?? 'app',
      image: userTemplate?.workload_config.image ?? builtinTpl?.image ?? null,
      addons: userTemplate
        ? userTemplate.addons.map(a => a.addon_name)
        : builtinTpl?.addons ?? [],
      variables: values,
    });

    setTimeout(() => {
      setDeploying(false);
      setDeployed(true);
    }, 1500);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="px-8 py-8 max-w-2xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Deploy: {resolvedName}</h1>
        <div className="flex gap-1.5 mt-2">
          {resolvedComponents.map((c) => (
            <Badge key={c} variant="secondary" className="text-xs bg-zinc-100 text-zinc-600">{c}</Badge>
          ))}
        </div>
      </div>

      {deployed ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-medium text-emerald-800">Stack Deployed!</h2>
            <p className="text-sm text-emerald-600">
              {values.app_name || 'Your stack'} is being provisioned.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => router.push('/apps')}>
                View Apps
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
            <p className="text-sm text-zinc-500 mb-4">Configure your stack parameters:</p>

            {resolvedVariables.map((v) => (
              <div key={v.key} className="space-y-1.5">
                <Label htmlFor={v.key} className="text-xs font-medium text-zinc-600">{v.label}</Label>
                <Input
                  id={v.key}
                  value={values[v.key] || ''}
                  onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                  className="border-zinc-200"
                />
                <p className="text-xs text-zinc-400">{v.description}</p>
              </div>
            ))}

            <Button className="w-full mt-4" onClick={handleDeploy} disabled={deploying}>
              {deploying ? 'Deploying...' : 'Deploy Stack'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
