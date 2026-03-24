'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';

const templateData: Record<string, { name: string; components: string[]; variables: { key: string; label: string; default: string; description: string }[] }> = {
  'node-postgres': {
    name: 'Node.js + PostgreSQL',
    components: ['Node.js App', 'PostgreSQL'],
    variables: [
      { key: 'app_name', label: 'Application Name', default: 'my-app', description: 'Used for service names and database' },
      { key: 'node_version', label: 'Node.js Version', default: '20', description: 'Node.js major version' },
      { key: 'db_name', label: 'Database Name', default: 'myapp', description: 'PostgreSQL database name' },
      { key: 'db_memory', label: 'Database Memory', default: '256Mi', description: 'Memory allocation for PostgreSQL' },
      { key: 'db_storage', label: 'Database Storage', default: '5Gi', description: 'Persistent volume size' },
    ],
  },
  'rails-redis-postgres': {
    name: 'Rails + Redis + PostgreSQL',
    components: ['Rails App', 'PostgreSQL', 'Redis'],
    variables: [
      { key: 'app_name', label: 'Application Name', default: 'my-rails-app', description: 'Used for service names' },
      { key: 'ruby_version', label: 'Ruby Version', default: '3.3', description: 'Ruby version' },
      { key: 'db_name', label: 'Database Name', default: 'rails_production', description: 'PostgreSQL database name' },
      { key: 'redis_memory', label: 'Redis Memory', default: '128Mi', description: 'Memory for Redis cache' },
      { key: 'worker_replicas', label: 'Sidekiq Workers', default: '2', description: 'Number of background job workers' },
    ],
  },
};

const defaultTemplate = {
  name: 'Custom Stack',
  components: ['App', 'Database'],
  variables: [
    { key: 'app_name', label: 'Application Name', default: 'my-app', description: 'Application name' },
    { key: 'replicas', label: 'Replicas', default: '1', description: 'Number of replicas' },
  ],
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
  const template = templateData[templateId] || defaultTemplate;

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(template.variables.map((v) => [v.key, v.default]))
  );
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const handleDeploy = () => {
    setDeploying(true);
    setTimeout(() => {
      setDeploying(false);
      setDeployed(true);
    }, 2000);
  };

  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700">
          <ArrowLeft className="h-4 w-4" /> Back to templates
        </button>

        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Deploy: {template.name}</h1>
          <div className="flex gap-1.5 mt-2">
            {template.components.map((c) => (
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
                {values.app_name || 'Your stack'} is being provisioned. Components will be ready in ~2 minutes.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
                  Go to Dashboard
                </Button>
                <Button size="sm" onClick={() => { setDeployed(false); setValues(Object.fromEntries(template.variables.map((v) => [v.key, v.default]))); }}>
                  Deploy Another
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-zinc-200">
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-zinc-500 mb-4">Configure your stack parameters:</p>

              {template.variables.map((v) => (
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
    </AppLayout>
  );
}
