'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useSearchParams } from 'next/navigation';
import { clustersApi } from '@/lib/api/clusters';
import { getProject } from '@/api/projects';

export interface Crumb {
  label: string;
  href?: string;
}

const STATIC_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  apps: 'Apps',
  clusters: 'Clusters',
  stacks: 'Stacks',
  activity: 'Activity',
  settings: 'Settings',
};

/**
 * Breadcrumb trail for the current route. Resolves the Clusters › {cluster} ›
 * {project} › {app} hierarchy from the real backend where the URL gives us an id.
 */
export function useBreadcrumbs(): Crumb[] {
  const pathname = usePathname() || '/';
  const search = useSearchParams();
  const seg = pathname.split('/').filter(Boolean);

  // Resolve a cluster (for /clusters/[id]/* and indirectly for project/app pages).
  const clusterIdFromPath = seg[0] === 'clusters' && seg[1] && seg[1] !== 'new' ? seg[1] : undefined;
  // Resolve a project: /projects/[id]/* or ?project_id= on app pages.
  const projectIdFromPath = seg[0] === 'projects' && seg[1] && seg[1] !== 'new' ? seg[1] : undefined;
  const projectIdFromQuery = (seg[0] === 'apps' && seg[1] && seg[1] !== 'new' ? search.get('project_id') : null) || undefined;
  const projectId = projectIdFromPath || projectIdFromQuery;

  const project = useQuery({
    queryKey: ['projects', 'one', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });
  // For project/app pages the cluster id comes from the resolved project.
  const clusterId = clusterIdFromPath || project.data?.cluster_id || undefined;
  const cluster = useQuery({
    queryKey: ['clusters', clusterId],
    queryFn: () => clustersApi.get(clusterId!),
    enabled: !!clusterId,
  });

  const out: Crumb[] = [];
  const push = (label: string, href?: string) => out.push({ label, href });

  if (seg.length === 0) return [{ label: 'Dashboard' }];

  switch (seg[0]) {
    case 'clusters': {
      push('Clusters', '/clusters');
      if (seg[1] === 'new') push('Register cluster');
      else if (clusterIdFromPath) {
        const cName = cluster.data?.name || clusterIdFromPath;
        if (seg.length === 2) push(cName);
        else {
          push(cName, `/clusters/${clusterIdFromPath}`);
          if (seg[2] === 'provisioning') push('Provisioning');
          else if (seg[2] === 'projects' && seg[3] === 'new') push('New project');
          else push(seg[2]);
        }
      }
      break;
    }
    case 'projects': {
      if (seg[1] === 'new') {
        push('Projects', '/projects');
        push('New project');
        break;
      }
      if (projectIdFromPath) {
        // Clusters › {cluster} › {project} › …
        if (cluster.data) push(cluster.data.name, `/clusters/${cluster.data.id}`);
        else push('Clusters', '/clusters');
        const pName = project.data?.name || projectIdFromPath;
        if (seg.length === 2) push(pName);
        else {
          push(pName, `/projects/${projectIdFromPath}`);
          if (seg[2] === 'addons') {
            push('Add-ons');
            if (seg[3] && seg[3] !== 'new') push(seg[4] || 'Instance');
            else if (seg[3] === 'new') push('New add-on');
          } else push(seg[2]);
        }
      } else {
        push('Projects', '/projects');
      }
      break;
    }
    case 'apps': {
      if (seg[1] === 'new') {
        push('Apps', '/apps');
        push('New app');
        break;
      }
      if (seg[1] === 'stacks') {
        push('Apps', '/apps');
        push('Stack');
        break;
      }
      if (seg[1] && seg[2]) {
        // /apps/[ns]/[name]?project_id= → Clusters › {cluster} › {project} › {app}
        if (cluster.data) push(cluster.data.name, `/clusters/${cluster.data.id}`);
        if (project.data) push(project.data.name, `/projects/${project.data.id}`);
        if (!cluster.data && !project.data) push('Apps', '/apps');
        push(decodeURIComponent(seg[2]));
      } else {
        push('Apps', '/apps');
      }
      break;
    }
    case 'admin': {
      if (seg[1] === 'addon-definitions') {
        push('Add-ons catalog', '/admin/addon-definitions');
        if (seg[2] === 'new') push('New definition');
        else if (seg[2] && seg[3] === 'edit') push('Edit definition');
      } else push('Admin');
      break;
    }
    case 'settings': {
      if (seg[1] === 'stack-templates') {
        push('Stack templates', '/settings/stack-templates');
        if (seg[2] === 'new') push('New template');
        else if (seg[2] && seg[3]) push(decodeURIComponent(seg[3]));
      } else if (seg[1] === 'cloud-credentials') {
        if (seg[2]) { push('Cloud providers', '/settings/cloud-credentials'); push(seg[2].toUpperCase()); }
        else push('Cloud providers');
      } else if (seg[1] === 'teams') {
        push('Members');
      } else if (seg[1] === 'rbac') {
        push('RBAC');
      } else if (seg[1] === 'sso') {
        push('Settings', '/settings');
        push('SSO');
      } else {
        push('Settings');
      }
      break;
    }
    default:
      push(STATIC_LABELS[seg[0]] ?? seg[0]);
      if (seg[1]) push(seg[1]);
  }

  return out.length ? out : [{ label: 'KubeNest' }];
}
