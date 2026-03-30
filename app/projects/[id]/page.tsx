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
import { WorkloadList } from '@/components/workloads/WorkloadList';
import { AddonInstanceList } from '@/components/addons/AddonInstanceList';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getProject, deleteProject, createRegistrySecret } from '@/api/projects';
import { getCluster } from '@/api/clusters';
import {
  getDemoProject, getDemoCluster, deleteDemoProject,
  type DemoProject, type DemoCluster,
} from '@/lib/demo-store';

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
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
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
            <Link href={`/projects/${project.id}/workloads/new`}>Deploy Workload</Link>
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

      {/* Workloads — primary content */}
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
                <CardTitle className="text-base font-semibold text-zinc-900">Workloads</CardTitle>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Deployments running in this project
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={`/projects/${project.id}/workloads/new`}>Deploy</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <WorkloadList projectId={project.id} />
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

      {/* Metadata + Events */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.3, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: 'Namespace',
                  value: (
                    <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono">
                      {project.namespace}
                    </code>
                  ),
                },
                {
                  label: 'Cluster',
                  value: cluster ? (
                    <Link
                      href={`/clusters/${cluster.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {cluster.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-zinc-400">Unknown</span>
                  ),
                },
                {
                  label: 'Status',
                  value: <ProjectStatusBadge status={project.status as any} />,
                },
                {
                  label: 'Created',
                  value: (
                    <span className="text-sm text-zinc-700">
                      {format(new Date(project.created_at), 'PPpp')}
                    </span>
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1.5">
                    {label}
                  </p>
                  {value}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4, delay: 0.36, ease: easeOutQuart }}
        >
          <Card className="border-zinc-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Status Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-zinc-900">Project created</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {format(new Date(project.created_at), 'PPpp')}
                    </p>
                  </div>
                </div>
                {project.updated_at && project.updated_at !== project.created_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium text-zinc-900">Project updated</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {format(new Date(project.updated_at), 'PPpp')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

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
              disabled={registrySaving || !registryForm.name || !registryForm.server_url || !registryForm.username || !registryForm.password}
            >
              {registrySaving ? 'Creating...' : 'Add Secret'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
