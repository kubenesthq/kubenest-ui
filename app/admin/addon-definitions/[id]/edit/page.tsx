'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addonDefinitionsApi } from '@/lib/api/addons';
import type { AddonDefinitionUpdate } from '@/types/api';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

export default function EditAddonDefinitionPage() {
  const router = useRouter();
  const params = useParams();
  const defId = params.id as string;
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [chartRepo, setChartRepo] = useState('');
  const [chartName, setChartName] = useState('');
  const [chartVersion, setChartVersion] = useState('');
  const [defaultValues, setDefaultValues] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: def, isLoading } = useQuery({
    queryKey: ['addon-definition', defId],
    queryFn: () => addonDefinitionsApi.get(defId),
  });

  useEffect(() => {
    if (def) {
      setName(def.name);
      setIcon(def.icon ?? '');
      setDescription(def.description ?? '');
      setTags(def.tags?.join(', ') ?? '');
      setChartRepo(def.chart_config?.repo ?? '');
      setChartName(def.chart_config?.name ?? '');
      setChartVersion(def.chart_config?.version ?? '');
      setDefaultValues(
        def.default_values ? JSON.stringify(def.default_values, null, 2) : ''
      );
    }
  }, [def]);

  const updateMutation = useMutation({
    mutationFn: (data: AddonDefinitionUpdate) => addonDefinitionsApi.update(defId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['addon-definition', defId] });
      router.push('/admin/addon-definitions');
    },
    onError: (err: Error) => {
      setErrors({ submit: err.message });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
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

    const payload: AddonDefinitionUpdate = {};

    if (name.trim() !== def?.name) payload.name = name.trim();
    if (icon.trim() !== (def?.icon ?? '')) payload.icon = icon.trim();
    if (description.trim() !== (def?.description ?? '')) payload.description = description.trim();

    const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (JSON.stringify(parsedTags) !== JSON.stringify(def?.tags ?? [])) {
      payload.tags = parsedTags;
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

    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!def) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-400">
            Addon definition not found
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Edit {def.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">Update addon definition details</p>
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={errors.name ? 'border-red-300' : ''}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="icon" className="text-xs font-medium text-zinc-600 mb-1 block">
                  Icon (emoji)
                </Label>
                <Input
                  id="icon"
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
                value={tags}
                onChange={(e) => setTags(e.target.value)}
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
        <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/addon-definitions">Cancel</Link>
        </Button>
        {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
      </motion.div>
    </div>
  );
}
