'use client';

import { Shield, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';


const ENFORCEMENT_LABEL: Record<string, string> = {
  'role': 'role',
  'membership': 'organization membership only',
  'membership-partial': 'organization membership only (unscoped list not filtered)',
  'signed-in': 'only that you are signed in',
  'absent': 'no such feature',
};

const roles = [
  // THESE DESCRIPTIONS WERE THE SAME FALSE CLAIM AS THE TABLE, IN PROSE (kn-kziv).
  // "Read-only access" was untrue: the API does not stop a viewer deleting an app.
  // A description is an assertion too, so correcting the table and leaving these
  // would have left the page stating the model it was fixed for stating.
  { name: 'Admin', description: 'The only role the API checks. Required to delete a project and to invite members.', color: 'bg-blue-100 text-blue-700' },
  { name: 'Developer', description: 'Stored as the role "member". The API treats it the same as Viewer, except that it cannot delete a project or invite members.', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'Viewer', description: 'Not read-only. The API places no restriction on this role beyond the two admin-only actions.', color: 'bg-zinc-100 text-zinc-600' },
];

// ENFORCEMENT, AUDITED AT THE BACKEND SOURCE 2026-09-12 (kn-kziv).
// `enforcement` says what the API actually checks for this resource's action:
//   'role'               the API reads the org role and refuses the wrong one.
//   'membership'         the API checks org MEMBERSHIP ONLY and never reads the
//                        role, so admin, member and viewer are treated alike.
//   'membership-partial' as above when the request is scoped; the unscoped list
//                        route is not org-filtered and was not audited further.
//   'signed-in'          no organization check at all; any authenticated user.
//   'absent'             no such feature exists in the API.
// The role columns are rendered ONLY for 'role' rows. Showing a tick or a cross
// where the API does not read the role is itself an assertion, and it was the
// defect this page had: it stated a permission model that is not in force.
const permissions = [
  { resource: 'Clusters', admin: true, developer: false, viewer: false, enforcement: 'membership' },
  { resource: 'Register Cluster', admin: true, developer: false, viewer: false, enforcement: 'membership' },
  { resource: 'Projects', admin: true, developer: true, viewer: true, enforcement: 'membership' },
  { resource: 'Create Project', admin: true, developer: true, viewer: false, enforcement: 'membership' },
  { resource: 'Delete Project', admin: true, developer: false, viewer: false, enforcement: 'role' },
  { resource: 'Apps', admin: true, developer: true, viewer: true, enforcement: 'membership-partial' },
  { resource: 'Create App', admin: true, developer: true, viewer: false, enforcement: 'membership' },
  { resource: 'Update App', admin: true, developer: true, viewer: false, enforcement: 'membership' },
  { resource: 'Delete App', admin: true, developer: false, viewer: false, enforcement: 'membership' },
  { resource: 'Addons', admin: true, developer: true, viewer: true, enforcement: 'membership' },
  { resource: 'Deploy Addon', admin: true, developer: true, viewer: false, enforcement: 'membership' },
  { resource: 'Addon Catalog', admin: true, developer: false, viewer: false, enforcement: 'signed-in' },
  { resource: 'Stack Templates', admin: true, developer: true, viewer: true, enforcement: 'signed-in' },
  { resource: 'Deploy Stack', admin: true, developer: true, viewer: false, enforcement: 'membership' },
  { resource: 'Create Template', admin: true, developer: false, viewer: false, enforcement: 'signed-in' },
  { resource: 'Teams', admin: true, developer: false, viewer: false, enforcement: 'membership' },
  { resource: 'Invite Members', admin: true, developer: false, viewer: false, enforcement: 'role' },
  { resource: 'SSO Configuration', admin: true, developer: false, viewer: false, enforcement: 'absent' },
  { resource: 'Audit Logs', admin: true, developer: false, viewer: false, enforcement: 'membership' },
  { resource: 'Billing / Cost', admin: true, developer: false, viewer: false, enforcement: 'absent' },
];

function NotByRole() {
  return <span className="text-zinc-300" title="the API does not read the role for this action">&mdash;</span>;
}

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
            <h2 className="text-sm font-medium text-zinc-900 mb-2">Permissions Matrix</h2>
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-medium">The API checks the role on two of these actions. It does not check it on the rest.</p>
              <p className="mt-1">
                Role columns are filled in only where the API actually reads the role. Everywhere
                else it checks that you belong to the organization, or only that you are signed in,
                so any member can perform those actions whatever role you assign them. Assign roles
                for clarity, not as a security control. This describes the API as it is today and is
                not a statement that the remaining rows are planned.
              </p>
              <p className="mt-1">
                Roles are stored as <span className="font-mono">admin</span>,{' '}
                <span className="font-mono">member</span> and <span className="font-mono">viewer</span>;
                &ldquo;Developer&rdquo; here is the stored role <span className="font-mono">member</span>.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide w-1/2">Resource</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Admin</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Developer</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Viewer</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">What the API checks</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm) => {
                    const byRole = perm.enforcement === 'role';
                    return (
                      <tr key={perm.resource} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                        <td className="py-2 px-3 text-zinc-700">{perm.resource}</td>
                        <td className="py-2 px-3 text-center">{byRole ? <PermIcon allowed={perm.admin} /> : <NotByRole />}</td>
                        <td className="py-2 px-3 text-center">{byRole ? <PermIcon allowed={perm.developer} /> : <NotByRole />}</td>
                        <td className="py-2 px-3 text-center">{byRole ? <PermIcon allowed={perm.viewer} /> : <NotByRole />}</td>
                        <td className="py-2 px-3 text-xs text-zinc-500">{ENFORCEMENT_LABEL[perm.enforcement]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    
  );
}
