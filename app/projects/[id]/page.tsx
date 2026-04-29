'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProjectStatusBadge } from '@/components/projects/ProjectStatusBadge';
import { AddonInstanceList } from '@/components/addons/AddonInstanceList';
import { useApps } from '@/hooks/useApps';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getProject, deleteProject, createRegistrySecret, getRegistrySecrets } from '@/api/projects';
import { getCluster } from '@/api/clusters';
import {
  getDemoProject, getDemoCluster, deleteDemoProject,
  type DemoProject, type DemoCluster,
} from '@/lib/demo-store';

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/;

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const easeOutQuart = [0.25, 1, 0.5, 1] as const;

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRegistryDialog, setShowRegistryDialog] = useState(false);
  const [registryForm, setRegistryForm] = useState({ name: '', server_url: '', username: '', password: '' });
  const [registrySaving, setRegistrySaving] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);

  // Try demo project first
  const [demoProject, setDemoProject] = useState<DemoProject | null>(null);
  const [demoCluster, setDemoCluster] = useState<DemoCluster | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoChecked, setDemoChecked] = useState(false);

  useEffect(() => {
    const dp = getDemoProject(projectId);
    if (dp) {
      setDemoProject(dp);
      setDemoCluster(getDemoCluster(dp.cluster_id));
      setIsDemo(true);
    }
    setDemoChecked(true);
  }, [projectId]);

  // API project (only if not demo)
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: demoChecked && !isDemo,
  });

  const { data: clusterData } = useQuery({
    queryKey: ['cluster', projectData?.cluster_id],
    queryFn: () => getCluster(projectData!.cluster_id),
    enabled: !isDemo && !!projectData?.cluster_id,
  });

  const { data: registrySecrets } = useQuery({
    queryKey: ['registry-secrets', projectId],
    queryFn: () => getRegistrySecrets(projectId),
    enabled: demoChecked && !isDemo,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onMutate: () => { setIsDeleting(true); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/projects');
    },
    onError: (error: Error) => {
      alert(`Failed to delete project: ${error.message}`);
      setIsDeleting(false);
      setShowDeleteDialog(false);
    },
  });

  const handleDelete = () => {
    if (isDemo) {
      deleteDemoProject(projectId);
      router.push('/dashboard');
    } else {
      deleteMutation.mutate(projectId);
    }
  };

  const handleRegistrySubmit = async () => {
    setRegistrySaving(true);
    setRegistryError(null);
    try {
      await createRegistrySecret(projectId, registryForm);
      queryClient.invalidateQueries({ queryKey: ['registry-secrets', projectId] });
      setShowRegistryDialog(false);
      setRegistryForm({ name: '', server_url: '', username: '', password: '' });
    } catch (err) {
      setRegistryError(err instanceof Error ? err.message : 'Failed to create registry secret');
    } finally {
      setRegistrySaving(false);
    }
  };

  if (!demoChecked || (!isDemo && projectLoading)) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Normalize project shape for rendering
  const project = isDemo && demoProject
    ? {
        id: demoProject.id,
        cluster_id: demoProject.cluster_id,
        name: demoProject.name,
        namespace: demoProject.namespace,
        description: demoProject.description,
        status: demoProject.status,
        created_at: demoProject.created_at,
        updated_at: null as string | null,
      }
    : projectData;

  if (!project) {
    return (
      <div className="px-8 py-8 max-w-5xl">
        <Card className="border-zinc-200">
          <CardContent className="pt-6 text-center text-sm text-zinc-400">
            Project not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const cluster = isDemo ? (demoCluster ? { id: demoCluster.id, name: demoCluster.name } : null) : clusterData;

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      {/* Breadcrumb */}
      {cluster && (
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
            <Link href={`/clusters/${cluster.id}`}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              {cluster.name}
            </Link>
          </Button>
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        className="flex items-start justify-between"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.05, ease: easeOutQuart }}
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{project.name}</h1>
            <ProjectStatusBadge status={project.status as any} />
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Created {format(new Date(project.created_at), 'MMMM d, yyyy')}
            {cluster && (
              <>
                {' · '}
                <Link
                  href={`/clusters/${cluster.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {cluster.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRegistryDialog(true)}
          >
            <KeyRound className="h-3.5 w-3.5 mr-1.5" />
            Add Registry
          </Button>
          <Button asChild size="sm">
            <Link href={`/apps/new?project_id=${project.id}`}>Create App</Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete
          </Button>
        </div>
      </motion.div>

      {/* Apps — primary content */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.15, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-zinc-900">Apps</CardTitle>
                <p className="text-sm text-zinc-500 mt-0.5">
                  StackDeploys running in this project
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={`/apps/new?project_id=${project.id}`}>Create</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ProjectAppsList projectId={project.id} projectNamespace={project.namespace} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Addons */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.22, ease: easeOutQuart }}
      >
        <Card className="border-zinc-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-zinc-900">Addons</CardTitle>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Managed backing services (databases, queues, caches)
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${project.id}/addons/new`}>Add Addon</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <AddonInstanceList projectId={project.id} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Registry Secrets */}
      {registrySecrets && registrySecrets.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.28, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">Registry Secrets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-zinc-100">
                {registrySecrets.map((secret) => (
                  <div key={secret.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-4 w-4 text-zinc-400" />
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{secret.name}</p>
                        <p className="text-xs text-zinc-500">{secret.server_url} &middot; {secret.username}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{project.name}</strong>? This will delete the
              Kubernetes namespace and all resources within it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRegistryDialog} onOpenChange={setShowRegistryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Registry Secret</DialogTitle>
            <DialogDescription>
              Add a container registry pull secret to <strong>{project.name}</strong>.
              The operator will create a Kubernetes docker-registry secret in the namespace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {registryError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{registryError}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Secret Name</Label>
              <Input
                id="reg-name"
                placeholder="e.g. docker-hub"
                value={registryForm.name}
                onChange={(e) => setRegistryForm({ ...registryForm, name: e.target.value })}
              />
              {registryForm.name && !K8S_NAME_RE.test(registryForm.name) && (
                <p className="text-xs text-red-500 mt-1">
                  Lowercase letters, numbers, hyphens, and dots only. Must start and end with alphanumeric.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-url">Registry URL</Label>
              <Input
                id="reg-url"
                placeholder="e.g. https://index.docker.io/v1/"
                value={registryForm.server_url}
                onChange={(e) => setRegistryForm({ ...registryForm, server_url: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-user">Username</Label>
              <Input
                id="reg-user"
                placeholder="Registry username"
                value={registryForm.username}
                onChange={(e) => setRegistryForm({ ...registryForm, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-pass">Password</Label>
              <Input
                id="reg-pass"
                type="password"
                placeholder="Registry password or token"
                value={registryForm.password}
                onChange={(e) => setRegistryForm({ ...registryForm, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRegistryDialog(false)}
              disabled={registrySaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegistrySubmit}
              disabled={registrySaving || !registryForm.name || !K8S_NAME_RE.test(registryForm.name) || !registryForm.server_url || !registryForm.username || !registryForm.password}
            >
              {registrySaving ? 'Creating...' : 'Add Secret'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectAppsList({
  projectId,
  projectNamespace,
}: {
  projectId: string;
  projectNamespace: string;
}) {
  const router = useRouter();
  const appsQuery = useApps({ project_id: projectId });

  if (appsQuery.isLoading) {
    return <div className="py-6 text-sm text-zinc-400">Loading apps…</div>;
  }
  if (appsQuery.isError) {
    return (
      <div className="py-6 text-sm text-zinc-400">
        Apps unavailable for this project.
      </div>
    );
  }
  const apps = appsQuery.data?.data ?? [];
  if (apps.length === 0) {
    return (
      <div className="py-6 text-sm text-zinc-500">
        No apps deployed in this project yet.
      </div>
    );
  }
  return (
    <div className="divide-y divide-zinc-100">
      {apps.map((a) => (
        <button
          key={`${a.namespace}/${a.name}`}
          type="button"
          onClick={() =>
            router.push(`/apps/${a.namespace}/${a.name}?project_id=${projectId}`)
          }
          className="w-full flex items-center justify-between py-3 text-left hover:bg-zinc-50 px-2 -mx-2 rounded transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">{a.name}</p>
            <p className="text-xs text-zinc-500">
              {a.component_count} component{a.component_count === 1 ? '' : 's'}
              {projectNamespace && ` · ${projectNamespace}`}
            </p>
          </div>
          <span className="text-xs text-zinc-600">{a.phase}</span>
        </button>
      ))}
    </div>
  );
}
