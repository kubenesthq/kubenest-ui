'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrg } from '@/hooks/useOrganization';
import { getCloudCredentials } from '@/api/cloud-credentials';
import { createCluster } from '@/api/clusters';
import type { CloudCredential } from '@/types/api';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-south-1', 'ap-southeast-1', 'ap-northeast-1',
];

const INSTANCE_TYPES = [
  { value: 't3.medium', label: 't3.medium (2 vCPU, 4 GiB)' },
  { value: 't3.large', label: 't3.large (2 vCPU, 8 GiB)' },
  { value: 't3.xlarge', label: 't3.xlarge (4 vCPU, 16 GiB)' },
  { value: 'm5.large', label: 'm5.large (2 vCPU, 8 GiB)' },
  { value: 'm5.xlarge', label: 'm5.xlarge (4 vCPU, 16 GiB)' },
  { value: 'm5.2xlarge', label: 'm5.2xlarge (8 vCPU, 32 GiB)' },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};
const easeOutQuart = [0.25, 1, 0.5, 1] as const;

type WizardStep = 'credential' | 'configure' | 'review';

interface ProvisionConfig {
  credentialId: string;
  credentialName: string;
  region: string;
  instanceType: string;
  nodeCount: number;
  clusterName: string;
  description: string;
}

const defaultConfig: ProvisionConfig = {
  credentialId: '',
  credentialName: '',
  region: 'us-east-1',
  instanceType: 't3.large',
  nodeCount: 3,
  clusterName: '',
  description: '',
};

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'credential', label: 'Credential' },
  { key: 'configure', label: 'Configure' },
  { key: 'review', label: 'Review' },
];

export default function ProvisionClusterPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth(true);
  const { orgId } = useCurrentOrg();
  const [step, setStep] = useState<WizardStep>('credential');
  const [config, setConfig] = useState<ProvisionConfig>(defaultConfig);
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const res = await getCloudCredentials(orgId!);
        setCredentials(res.data);
      } catch {
        setError('Failed to load cloud credentials');
      } finally {
        setLoadingCreds(false);
      }
    })();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createCluster(orgId!, {
        name: config.clusterName,
        description: config.description || undefined,
        provider: 'AWS',
        credential_id: config.credentialId,
        region: config.region,
        instance_type: config.instanceType,
        agent_count: config.nodeCount,
      });
      router.push(`/clusters/${result.id}/provisioning`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cluster');
      setSubmitting(false);
    }
  }

  function canProceed(): boolean {
    switch (step) {
      case 'credential':
        return !!config.credentialId;
      case 'configure':
        return !!config.clusterName && config.clusterName.length >= 3 && config.nodeCount >= 1;
      case 'review':
        return true;
      default:
        return false;
    }
  }

  function handleNext() {
    if (step === 'review') {
      handleSubmit();
    } else if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1].key);
    }
  }

  function handleBack() {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1].key);
    }
  }

  function selectCredential(cred: CloudCredential) {
    setConfig((prev) => ({
      ...prev,
      credentialId: cred.id,
      credentialName: cred.name,
      region: cred.region,
    }));
  }

  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: easeOutQuart }}
      >
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-zinc-400 hover:text-zinc-700 -ml-2">
          <Link href="/clusters/new">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back
          </Link>
        </Button>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Provision New Cluster</h1>
        <p className="text-sm text-zinc-500 mt-1">Create a managed Kubernetes cluster on your cloud provider</p>
      </motion.div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
                i < stepIndex
                  ? 'bg-emerald-100 text-emerald-700'
                  : i === stepIndex
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-400'
              }`}
            >
              {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs ${i === stepIndex ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-zinc-200" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Select Credential */}
      {step === 'credential' && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-base">Select Cloud Credential</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCreds ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : credentials.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <Cloud className="h-10 w-10 text-zinc-300 mx-auto" />
                  <p className="text-sm text-zinc-500">No cloud credentials configured.</p>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/settings/cloud-credentials">Add Credential</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {credentials.map((cred) => (
                    <button
                      key={cred.id}
                      type="button"
                      onClick={() => selectCredential(cred)}
                      className={`w-full text-left rounded-lg border p-4 transition-colors ${
                        config.credentialId === cred.id
                          ? 'border-zinc-900 bg-zinc-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center">
                            <Cloud className="h-4 w-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900">{cred.name}</p>
                            <p className="text-xs text-zinc-400">
                              {cred.provider} &middot; {cred.region} &middot; ****{cred.access_key_id.slice(-4)}
                            </p>
                          </div>
                        </div>
                        {config.credentialId === cred.id && (
                          <div className="h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Step 2: Configure */}
      {step === 'configure' && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-base">Cluster Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Cluster Name</Label>
                  <Input
                    placeholder="prod-us-west"
                    className="border-zinc-200"
                    value={config.clusterName}
                    onChange={(e) => setConfig({ ...config, clusterName: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  />
                  <p className="text-xs text-zinc-400">Lowercase, alphanumeric, hyphens only</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Description</Label>
                  <Input
                    placeholder="Production cluster in US West"
                    className="border-zinc-200"
                    value={config.description}
                    onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Region</Label>
                  <Select
                    value={config.region}
                    onValueChange={(v) => setConfig({ ...config, region: v })}
                  >
                    <SelectTrigger className="border-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AWS_REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Instance Type</Label>
                  <Select
                    value={config.instanceType}
                    onValueChange={(v) => setConfig({ ...config, instanceType: v })}
                  >
                    <SelectTrigger className="border-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTANCE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Node Count</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    className="border-zinc-200"
                    value={config.nodeCount}
                    onChange={(e) => setConfig({ ...config, nodeCount: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-zinc-400">1–20 worker nodes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.1, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-base">Review & Confirm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-zinc-400">Cluster Name</p>
                      <p className="font-mono text-zinc-900">{config.clusterName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Credential</p>
                      <p className="text-zinc-900">{config.credentialName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Region</p>
                      <p className="font-mono text-zinc-900">{config.region}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-zinc-400">Instance Type</p>
                      <p className="font-mono text-zinc-900">{config.instanceType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Node Count</p>
                      <p className="text-zinc-900">{config.nodeCount} nodes</p>
                    </div>
                    {config.description && (
                      <div>
                        <p className="text-xs text-zinc-400">Description</p>
                        <p className="text-zinc-900">{config.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
                  This will provision infrastructure on your AWS account. You will be billed by AWS for the resources created.
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          disabled={stepIndex === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button
          size="sm"
          onClick={handleNext}
          disabled={!canProceed() || submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {step === 'review' ? 'Provision Cluster' : 'Next'}
          {step !== 'review' && <ArrowRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}
