'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Database, Globe, MessageSquare, Zap, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';

const templates = [
  {
    id: 'node-postgres',
    name: 'Node.js + PostgreSQL',
    description: 'Full-stack Node.js app with managed PostgreSQL database and automatic connection wiring.',
    icon: Globe,
    components: ['Node.js App', 'PostgreSQL'],
    tags: ['popular', 'fullstack'],
    color: 'bg-green-500',
  },
  {
    id: 'rails-redis-postgres',
    name: 'Rails + Redis + PostgreSQL',
    description: 'Ruby on Rails with Sidekiq background jobs, Redis cache, and PostgreSQL.',
    icon: Zap,
    components: ['Rails App', 'PostgreSQL', 'Redis'],
    tags: ['popular', 'fullstack'],
    color: 'bg-red-500',
  },
  {
    id: 'nextjs-postgres',
    name: 'Next.js + PostgreSQL',
    description: 'Server-rendered React with PostgreSQL. Prisma ORM pre-configured.',
    icon: Globe,
    components: ['Next.js App', 'PostgreSQL'],
    tags: ['frontend', 'fullstack'],
    color: 'bg-zinc-900',
  },
  {
    id: 'django-postgres',
    name: 'Django + PostgreSQL',
    description: 'Python Django with PostgreSQL, Celery worker, and Redis message broker.',
    icon: Database,
    components: ['Django App', 'PostgreSQL', 'Redis', 'Celery Worker'],
    tags: ['python', 'fullstack'],
    color: 'bg-emerald-600',
  },
  {
    id: 'fastapi-postgres',
    name: 'FastAPI + PostgreSQL',
    description: 'Python async API with PostgreSQL and automatic OpenAPI docs.',
    icon: Zap,
    components: ['FastAPI App', 'PostgreSQL'],
    tags: ['python', 'api'],
    color: 'bg-teal-500',
  },
  {
    id: 'kafka-stream',
    name: 'Event Streaming Pipeline',
    description: 'Kafka cluster with a producer service, consumer service, and monitoring.',
    icon: MessageSquare,
    components: ['Kafka', 'Producer Service', 'Consumer Service'],
    tags: ['streaming', 'data'],
    color: 'bg-orange-500',
  },
];

export default function StacksPage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Stack Templates</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Deploy pre-configured application stacks in one click.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/stacks/deploy')}>
            Create Template
          </Button>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <Card key={template.id} className="border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer group">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`h-9 w-9 rounded-lg ${template.color} flex items-center justify-center shrink-0`}>
                    <template.icon className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-zinc-900 group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{template.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {template.components.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-600">
                      {c}
                    </Badge>
                  ))}
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => router.push(`/stacks/deploy?template=${template.id}`)}
                >
                  Deploy Stack
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
