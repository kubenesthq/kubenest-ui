'use client';

import { Shield, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';


const roles = [
  { name: 'Admin', description: 'Full access to all resources and settings', color: 'bg-blue-100 text-blue-700' },
  { name: 'Developer', description: 'Deploy and manage workloads within assigned projects', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'Viewer', description: 'Read-only access to assigned resources', color: 'bg-zinc-100 text-zinc-600' },
];

const permissions = [
  { resource: 'Clusters', admin: true, developer: false, viewer: false },
  { resource: 'Register Cluster', admin: true, developer: false, viewer: false },
  { resource: 'Projects', admin: true, developer: true, viewer: true },
  { resource: 'Create Project', admin: true, developer: true, viewer: false },
  { resource: 'Delete Project', admin: true, developer: false, viewer: false },
  { resource: 'Workloads', admin: true, developer: true, viewer: true },
  { resource: 'Deploy Workload', admin: true, developer: true, viewer: false },
  { resource: 'Scale Workload', admin: true, developer: true, viewer: false },
  { resource: 'Delete Workload', admin: true, developer: false, viewer: false },
  { resource: 'Addons', admin: true, developer: true, viewer: true },
  { resource: 'Deploy Addon', admin: true, developer: true, viewer: false },
  { resource: 'Addon Catalog', admin: true, developer: false, viewer: false },
  { resource: 'Stack Templates', admin: true, developer: true, viewer: true },
  { resource: 'Deploy Stack', admin: true, developer: true, viewer: false },
  { resource: 'Create Template', admin: true, developer: false, viewer: false },
  { resource: 'Teams', admin: true, developer: false, viewer: false },
  { resource: 'Invite Members', admin: true, developer: false, viewer: false },
  { resource: 'SSO Configuration', admin: true, developer: false, viewer: false },
  { resource: 'Audit Logs', admin: true, developer: false, viewer: false },
  { resource: 'Billing / Cost', admin: true, developer: false, viewer: false },
];

function PermIcon({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="h-4 w-4 text-emerald-500" />
  ) : (
    <X className="h-4 w-4 text-zinc-300" />
  );
}

export default function RBACPage() {
  const { isAuthenticated } = useAuth(true);

  if (!isAuthenticated) return null;

  return (
    
      <div className="px-8 py-8 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Access Control</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Role-based access control for your organization.</p>
        </div>

        {/* Roles overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roles.map((role) => (
            <Card key={role.name} className="border-zinc-200">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-zinc-400" />
                  <Badge className={`text-xs font-medium ${role.color}`}>{role.name}</Badge>
                </div>
                <p className="text-xs text-zinc-500">{role.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Permissions matrix */}
        <Card className="border-zinc-200">
          <CardContent className="pt-5 pb-2">
            <h2 className="text-sm font-medium text-zinc-900 mb-4">Permissions Matrix</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide w-1/2">Resource</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Admin</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Developer</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Viewer</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm) => (
                    <tr key={perm.resource} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="py-2 px-3 text-zinc-700">{perm.resource}</td>
                      <td className="py-2 px-3 text-center"><PermIcon allowed={perm.admin} /></td>
                      <td className="py-2 px-3 text-center"><PermIcon allowed={perm.developer} /></td>
                      <td className="py-2 px-3 text-center"><PermIcon allowed={perm.viewer} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    
  );
}
