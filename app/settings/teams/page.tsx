'use client';

import { useState } from 'react';
import { Users, Plus, MoreHorizontal, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';


const mockTeams = [
  {
    id: '1',
    name: 'Platform Engineering',
    members: [
      { name: 'Lakshmi N', email: 'lakshmi@lakshminp.com', role: 'Admin', avatar: 'LN' },
      { name: 'Priya S', email: 'priya@example.com', role: 'Developer', avatar: 'PS' },
      { name: 'Raj K', email: 'raj@example.com', role: 'Developer', avatar: 'RK' },
    ],
  },
  {
    id: '2',
    name: 'Backend Team',
    members: [
      { name: 'Anand M', email: 'anand@example.com', role: 'Admin', avatar: 'AM' },
      { name: 'Deepa R', email: 'deepa@example.com', role: 'Developer', avatar: 'DR' },
    ],
  },
  {
    id: '3',
    name: 'Frontend Team',
    members: [
      { name: 'Kavitha P', email: 'kavitha@example.com', role: 'Admin', avatar: 'KP' },
      { name: 'Suresh V', email: 'suresh@example.com', role: 'Viewer', avatar: 'SV' },
      { name: 'Meena L', email: 'meena@example.com', role: 'Developer', avatar: 'ML' },
      { name: 'Arun T', email: 'arun@example.com', role: 'Developer', avatar: 'AT' },
    ],
  },
];

const roleColors: Record<string, string> = {
  Admin: 'bg-blue-100 text-blue-700',
  Developer: 'bg-emerald-100 text-emerald-700',
  Viewer: 'bg-zinc-100 text-zinc-600',
};

export default function TeamsPage() {
  const { isAuthenticated } = useAuth(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  return (
    
      <div className="px-8 py-8 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Teams</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Manage teams and their members across your organization.</p>
          </div>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Team
          </Button>
        </div>

        <div className="space-y-4">
          {mockTeams.map((team) => (
            <Card key={team.id} className="border-zinc-200">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-900">{team.name}</h3>
                      <p className="text-xs text-zinc-400">{team.members.length} members</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowInviteModal(team.id)}>
                      <Mail className="h-3.5 w-3.5 mr-1" /> Invite
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {team.members.map((member) => (
                    <div key={member.email} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-50">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600">
                          {member.avatar}
                        </div>
                        <div>
                          <p className="text-sm text-zinc-700">{member.name}</p>
                          <p className="text-xs text-zinc-400">{member.email}</p>
                        </div>
                      </div>
                      <Badge className={`text-xs font-normal ${roleColors[member.role]}`}>
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Team Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
            <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-lg font-semibold text-zinc-900">Create Team</h2>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Team Name</Label>
                  <Input placeholder="e.g. Platform Engineering" className="border-zinc-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Description</Label>
                  <Input placeholder="What does this team work on?" className="border-zinc-200" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                  <Button size="sm" onClick={() => { setShowCreateModal(false); alert('Team created!'); }}>Create</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInviteModal(null)}>
            <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-lg font-semibold text-zinc-900">Invite Member</h2>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Email Address</Label>
                  <Input type="email" placeholder="colleague@example.com" className="border-zinc-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Role</Label>
                  <select className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm">
                    <option>Developer</option>
                    <option>Admin</option>
                    <option>Viewer</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowInviteModal(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => { setShowInviteModal(null); alert('Invitation sent!'); }}>Send Invite</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    
  );
}
