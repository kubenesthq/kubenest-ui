'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectList } from '@/components/projects/ProjectList';
import { ClusterFilter } from '@/components/projects/ClusterFilter';
import { getClusters } from '@/api/clusters';
import { getProjects, deleteProject } from '@/api/projects';

export default function ProjectsPage() {
  const [selectedCluster, setSelectedCluster] = useState('all');
  const [deletingId, setDeletingId] = useState<string | undefined>();
  const queryClient = useQueryClient();

  // Fetch clusters for filter
  const { data: clustersData, isLoading: clustersLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  });

  // Fetch all projects (we'll filter client-side for now)
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: async () => {
      // Fetch projects from all clusters
      const clusters = clustersData?.data || [];
      if (clusters.length === 0) return { data: [] };

      const allProjects = await Promise.all(
        clusters.map(cluster =>
          getProjects(cluster.id).catch(() => ({ data: [] }))
        )
      );

      // Flatten and add cluster info
      const projects = allProjects.flatMap((result, index) =>
        result.data.map(project => ({
          ...project,
          cluster_name: clusters[index]?.name,
          workloads_count: 0, // TODO: fetch from API
        }))
      );

      return { data: projects };
    },
    enabled: !!clustersData,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onMutate: (id) => {
      setDeletingId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeletingId(undefined);
    },
    onError: () => {
      setDeletingId(undefined);
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  // Filter projects by cluster
  const filteredProjects = selectedCluster === 'all'
    ? projectsData?.data || []
    : (projectsData?.data || []).filter(p => p.cluster_id === selectedCluster);

  const clusters = clustersData?.data || [];
  const isLoading = clustersLoading || projectsLoading;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Kubernetes projects and namespaces
          </p>
        </div>
        <Button asChild disabled={clusters.length === 0}>
          <Link href={clusters.length > 0 ? `/clusters/${clusters[0].id}/projects/new` : '#'}>
            Create Project
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>All Projects</CardTitle>
          <ClusterFilter
            clusters={clusters}
            value={selectedCluster}
            onChange={setSelectedCluster}
            isLoading={isLoading}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading projects...
            </div>
          ) : clusters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No clusters available. Add a cluster first to create projects.
            </div>
          ) : (
            <ProjectList
              projects={filteredProjects}
              onDelete={handleDelete}
              isDeleting={deletingId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
