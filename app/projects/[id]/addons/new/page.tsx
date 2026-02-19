'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getProject } from '@/api/projects';
import { addonDefinitionsApi, addonInstancesApi } from '@/lib/api/addons';
import type { AddonDefinition, AddonType, AddonInstanceCreate } from '@/types/api';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

const STATIC_CATALOG: Array<{
  type: AddonType;
  name: string;
  description: string;
  icon: string;
  tags: string[];
}> = [
  {
    type: 'postgres',
    name: 'PostgreSQL',
    description: 'The world\'s most advanced open-source relational database.',
    icon: '🐘',
    tags: ['database', 'sql', 'relational'],
  },
  {
    type: 'redis',
    name: 'Redis',
    description: 'In-memory data structure store, used as a cache and message broker.',
    icon: '🔴',
    tags: ['cache', 'queue', 'pubsub'],
  },
  {
    type: 'kafka',
    name: 'Kafka',
    description: 'Distributed event streaming platform for high-throughput messaging.',
    icon: '📨',
    tags: ['streaming', 'events', 'messaging'],
  },
  {
    type: 'mongodb',
    name: 'MongoDB',
    description: 'Document-oriented NoSQL database for flexible data storage.',
    icon: '🍃',
    tags: ['database', 'nosql', 'document'],
  },
  {
    type: 'mysql',
    name: 'MySQL',
    description: 'Open-source relational database management system.',
    icon: '🐬',
    tags: ['database', 'sql', 'relational'],
  },
  {
    type: 'rabbitmq',
    name: 'RabbitMQ',
    description: 'Open-source message-broker software for reliable messaging.',
    icon: '🐰',
    tags: ['queue', 'messaging', 'amqp'],
  },
];

interface CatalogCard {
  id?: string;
  type: AddonType;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  isCustom?: boolean;
  fromBackend?: boolean;
}

export default function NewAddonPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [valuesJson, setValuesJson] = useState('');
  const [showValues, setShowValues] = useState(false);
  const [nameError, setNameError] = useState('');
  const [valuesError, setValuesError] = useState('');

  // Custom addon state
  const [customType, setCustomType] = useState<AddonType>('custom');
  const [customChartRepo, setCustomChartRepo] = useState('');
  const [customChartName, setCustomChartName] = useState('');
  const [customChartVersion, setCustomChartVersion] = useState('');

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });
  const project = projectData;

  const { data: definitionsData } = useQuery({
    queryKey: ['addon-definitions', project?.cluster_id],
    queryFn: () =>
      addonDefinitionsApi.list({ cluster_id: project!.cluster_id }),
    enabled: !!project?.cluster_id,
  });

  // Build catalog: backend definitions first, fall back to static list
  const backendDefs = definitionsData?.data ?? [];
  const usedTypes = new Set(backendDefs.map((d: AddonDefinition) => d.type));
  const staticFallback = STATIC_CATALOG.filter((s) => !usedTypes.has(s.type));

  const catalog: CatalogCard[] = [
    ...backendDefs.map((d: AddonDefinition) => ({
      id: d.id,
      type: d.type,
      name: d.name,
      description: d.description ?? '',
      icon: d.icon,
      tags: d.tags ?? [],
      fromBackend: true,
    })),
    ...staticFallback,
    {
      type: 'custom' as AddonType,
      name: 'Custom',
      description: 'Deploy any Helm chart as an addon.',
      icon: '⚙️',
      tags: ['custom', 'helm'],
      isCustom: true,
    },
  ];

  const createMutation = useMutation({
    mutationFn: (data: AddonInstanceCreate) => addonInstancesApi.create(data),
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: ['addon-instances', projectId] });
      router.push(`/projects/${projectId}/addons/${instance.id}`);
    },
  });

  const handleSelectCard = (card: CatalogCard) => {
    setSelectedCard(card);
    setNameError('');
    setValuesError('');
    if (!card.isCustom) {
      setInstanceName(card.name.toLowerCase().replace(/\s+/g, '-'));
    }
  };

  const handleSubmit = () => {
    setNameError('');
    setValuesError('');

    const trimmedName = instanceName.trim();
    if (!trimmedName) {
      setNameError('Instance name is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(trimmedName)) {
      setNameError('Name must be lowercase alphanumeric with dashes only');
      return;
    }

    let parsedValues: Record<string, unknown> | undefined;
    if (valuesJson.trim()) {
      try {
        parsedValues = JSON.parse(valuesJson);
      } catch {
        setValuesError('Invalid JSON');
        return;
      }
    }

    if (!selectedCard) return;

    const payload: AddonInstanceCreate = {
      project_id: projectId,
      name: trimmedName,
    };

    if (selectedCard.fromBackend && selectedCard.id) {
      payload.definition_id = selectedCard.id;
    } else {
      payload.type = selectedCard.isCustom ? customType : selectedCard.type;
    }

    if (parsedValues) {
      payload.values = parsedValues;
    }

    if (selectedCard.isCustom && customChartRepo && customChartName && customChartVersion) {
      payload.chart = {
        repo: customChartRepo,
        name: customChartName,
        version: customChartVersion,
      };
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: easeOutQuart }}
      >
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2"
        >
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            {project?.name ?? 'Project'}
          </Link>
        </Button>
      </motion.div>

      {/* Header */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Add Addon</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Choose a backing service to deploy into this project
        </p>
      </motion.div>

      {/* Catalog Grid */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.12, ease: easeOutQuart }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {catalog.map((card) => {
            const isSelected = selectedCard?.name === card.name && selectedCard?.type === card.type;
            return (
              <button
                key={`${card.type}-${card.name}`}
                type="button"
                onClick={() => handleSelectCard(card)}
                className={`text-left p-4 rounded-xl border transition-all duration-150 ${
                  isSelected
                    ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/30 shadow-sm'
                    : 'border-zinc-200 hover:border-blue-300 hover:shadow-sm bg-white'
                }`}
              >
                <div className="text-3xl mb-3 leading-none">{card.icon}</div>
                <p className="text-sm font-semibold text-zinc-900 mb-0.5">{card.name}</p>
                <p className="text-xs text-zinc-500 leading-relaxed mb-2">{card.description}</p>
                <div className="flex flex-wrap gap-1">
                  {card.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-zinc-100 text-zinc-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Deploy Config — shown when a card is selected */}
      {selectedCard && (
        <motion.div
          key={selectedCard.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Configure {selectedCard.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Custom chart fields */}
              {selectedCard.isCustom && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="custom-type" className="text-xs font-medium text-zinc-600 mb-1 block">
                      Type
                    </Label>
                    <select
                      id="custom-type"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value as AddonType)}
                      className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="custom">Custom</option>
                      <option value="postgres">PostgreSQL</option>
                      <option value="redis">Redis</option>
                      <option value="kafka">Kafka</option>
                      <option value="mongodb">MongoDB</option>
                      <option value="mysql">MySQL</option>
                      <option value="rabbitmq">RabbitMQ</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="chart-repo" className="text-xs font-medium text-zinc-600 mb-1 block">
                      Chart Repository URL
                    </Label>
                    <Input
                      id="chart-repo"
                      placeholder="https://charts.example.com"
                      value={customChartRepo}
                      onChange={(e) => setCustomChartRepo(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="chart-name" className="text-xs font-medium text-zinc-600 mb-1 block">
                      Chart Name
                    </Label>
                    <Input
                      id="chart-name"
                      placeholder="my-chart"
                      value={customChartName}
                      onChange={(e) => setCustomChartName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="chart-version" className="text-xs font-medium text-zinc-600 mb-1 block">
                      Chart Version
                    </Label>
                    <Input
                      id="chart-version"
                      placeholder="1.0.0"
                      value={customChartVersion}
                      onChange={(e) => setCustomChartVersion(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Instance name */}
              <div>
                <Label htmlFor="instance-name" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Instance Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="instance-name"
                  placeholder="my-postgres"
                  value={instanceName}
                  onChange={(e) => {
                    setInstanceName(e.target.value);
                    setNameError('');
                  }}
                  className={nameError ? 'border-red-300 focus-visible:ring-red-400' : ''}
                />
                {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
                <p className="text-xs text-zinc-400 mt-1">Lowercase alphanumeric and dashes only</p>
              </div>

              {/* Values override (collapsible) */}
              <div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
                  onClick={() => setShowValues(!showValues)}
                >
                  {showValues ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  Values override (optional)
                </button>
                {showValues && (
                  <div className="mt-2">
                    <Textarea
                      placeholder={'{\n  "key": "value"\n}'}
                      value={valuesJson}
                      onChange={(e) => {
                        setValuesJson(e.target.value);
                        setValuesError('');
                      }}
                      className={`font-mono text-xs min-h-[120px] ${valuesError ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
                    />
                    {valuesError && <p className="text-xs text-red-500 mt-1">{valuesError}</p>}
                  </div>
                )}
              </div>

              {createMutation.error && (
                <p className="text-sm text-red-500">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Failed to deploy addon'}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    'Deploy'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <Link href={`/projects/${projectId}`}>Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
