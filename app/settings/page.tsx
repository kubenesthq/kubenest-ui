'use client';

import { useRouter } from 'next/navigation';
import { Users, Shield, Key, Globe, Bell, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';


const settingsItems = [
  { name: 'Teams', description: 'Manage teams, members, and invitations', href: '/settings/teams', icon: Users, ready: true },
  { name: 'Access Control', description: 'Roles and permissions for your organization', href: '/settings/rbac', icon: Shield, ready: true },
  { name: 'Single Sign-On', description: 'Configure OIDC, SAML, or social login providers', href: '/settings/sso', icon: Key, ready: true },
  { name: 'Domains', description: 'Custom domains and wildcard DNS configuration', href: '#', icon: Globe, ready: false },
  { name: 'Notifications', description: 'Slack, email, and webhook alert configuration', href: '#', icon: Bell, ready: false },
  { name: 'Billing', description: 'Usage, cost showback, and subscription management', href: '#', icon: CreditCard, ready: false },
];

export default function SettingsPage() {
  const { isAuthenticated } = useAuth(true);
  const router = useRouter();

  if (!isAuthenticated) return null;

  return (
    
      <div className="px-8 py-8 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Settings</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Organization settings and configuration.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settingsItems.map((item) => (
            <Card
              key={item.name}
              className={`border-zinc-200 transition-all ${item.ready ? 'hover:border-zinc-300 hover:shadow-sm cursor-pointer' : 'opacity-60'}`}
              onClick={() => item.ready && router.push(item.href)}
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                    <item.icon className="h-4.5 w-4.5 text-zinc-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-zinc-900">{item.name}</h3>
                      {!item.ready && (
                        <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">Coming soon</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    
  );
}
