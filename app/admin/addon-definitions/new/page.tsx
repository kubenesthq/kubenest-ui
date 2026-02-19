'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addonDefinitionsApi } from '@/lib/api/addons';
import type { AddonDefinitionCreate, AddonType } from '@/types/api';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

const ADDON_TYPES: AddonType[] = ['postgres', 'redis', 'kafka', 'mongodb', 'mysql', 'rabbitmq', 'custom'];

export default function NewAddonDefinitionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<AddonType>('postgres');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [chartRepo, setChartRepo] = useState('');
  const [chartName, setChartName] = useState('');
  const [chartVersion, setChartVersion] = useState('');
  const [defaultValues, setDefaultValues] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: AddonDefinitionCreate) => addonDefinitionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-definitions'] });
      router.push('/admin/addon-definitions');
    },
    onError: (err: Error) => {
      setErrors({ submit: err.message });
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === name.toLowerCase().replace(/\s+/g, '-')) {
      setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!slug.trim()) newErrors.slug = 'Slug is required';
    if (!/^[a-z0-9-]+$/.test(slug)) newErrors.slug = 'Slug must be lowercase alphanumeric with dashes';
    if (defaultValues.trim()) {
      try {
        JSON.parse(defaultValues);
      } catch {
        newErrors.defaultValues = 'Invalid JSON';
      }
    }
    return newErrors;
  };

  const handleSubmit = () => {
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const payload: AddonDefinitionCreate = {
      name: name.trim(),
      slug: slug.trim(),
      type,
    };

    if (icon.trim()) payload.icon = icon.trim();
    if (description.trim()) payload.description = description.trim();
    if (clusterId.trim()) payload.cluster_id = clusterId.trim();
    if (tags.trim()) {
      payload.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (chartRepo.trim() && chartName.trim() && chartVersion.trim()) {
      payload.chart_config = {
        repo: chartRepo.trim(),
        name: chartName.trim(),
        version: chartVersion.trim(),
      };
    }
    if (defaultValues.trim()) {
      payload.default_values = JSON.parse(defaultValues);
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
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
          <Link href="/admin/addon-definitions">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Addon Catalog
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">New Addon Definition</h1>
        <p className="text-sm text-zinc-500 mt-1">Add a new addon to the catalog</p>
      </motion.div>

      {/* Form */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.12, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">Definition Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="PostgreSQL"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={errors.name ? 'border-red-300' : ''}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="slug" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Slug <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  placeholder="postgresql"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className={errors.slug ? 'border-red-300' : ''}
                />
                {errors.slug && <p className="text-xs text-red-500 mt-1">{errors.slug}</p>}
              </div>
              <div>
                <Label htmlFor="type" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Type <span className="text-red-500">*</span>
                </Label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as AddonType)}
                  className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ADDON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="icon" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Icon (emoji)
                </Label>
                <Input
                  id="icon"
                  placeholder="🐘"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-medium text-zinc-600 mb-1 block">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="A brief description of this addon"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="tags" className="text-xs font-medium text-zinc-600 mb-1 block">
                Tags (comma-separated)
              </Label>
              <Input
                id="tags"
                placeholder="database, sql, relational"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="cluster-id" className="text-xs font-medium text-zinc-600 mb-1 block">
                Cluster ID (optional — leave blank for global)
              </Label>
              <Input
                id="cluster-id"
                placeholder="cluster-uuid"
                value={clusterId}
                onChange={(e) => setClusterId(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Helm Chart */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.18, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">Helm Chart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="chart-repo" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Repository URL
                </Label>
                <Input
                  id="chart-repo"
                  placeholder="https://charts.bitnami.com/bitnami"
                  value={chartRepo}
                  onChange={(e) => setChartRepo(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="chart-name" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Chart Name
                </Label>
                <Input
                  id="chart-name"
                  placeholder="postgresql"
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="chart-version" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Version
                </Label>
                <Input
                  id="chart-version"
                  placeholder="12.5.8"
                  value={chartVersion}
                  onChange={(e) => setChartVersion(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="default-values" className="text-xs font-medium text-zinc-600 mb-1 block">
                Default Values (JSON)
              </Label>
              <Textarea
                id="default-values"
                placeholder={'{\n  "replicaCount": 1\n}'}
                value={defaultValues}
                onChange={(e) => setDefaultValues(e.target.value)}
                className={`font-mono text-xs min-h-[100px] ${errors.defaultValues ? 'border-red-300' : ''}`}
              />
              {errors.defaultValues && (
                <p className="text-xs text-red-500 mt-1">{errors.defaultValues}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Submit */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.24, ease: easeOutQuart }}
        className="flex items-center gap-3 pb-8"
      >
        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Definition'
          )}
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/addon-definitions">Cancel</Link>
        </Button>
        {errors.submit && (
          <p className="text-sm text-red-500">{errors.submit}</p>
        )}
      </motion.div>
    </div>
  );
}
