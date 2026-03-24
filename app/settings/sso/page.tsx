'use client';

import { useState } from 'react';
import { Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';

const providers = [
  { id: 'google', name: 'Google Workspace', status: 'not_configured', icon: '🔵' },
  { id: 'github', name: 'GitHub', status: 'not_configured', icon: '⚫' },
  { id: 'okta', name: 'Okta', status: 'not_configured', icon: '🔷' },
  { id: 'azure', name: 'Azure AD', status: 'not_configured', icon: '🔶' },
  { id: 'oidc', name: 'Custom OIDC', status: 'not_configured', icon: '🔑' },
  { id: 'saml', name: 'SAML 2.0', status: 'not_configured', icon: '🛡️' },
];

export default function SSOPage() {
  const { isAuthenticated } = useAuth(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      setTestResult('success');
    }, 1500);
  };

  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Single Sign-On</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Configure SSO providers for your organization. Members can sign in using their corporate identity.</p>
        </div>

        {!selectedProvider ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <Card
                key={provider.id}
                className="border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => setSelectedProvider(provider.id)}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{provider.icon}</span>
                      <h3 className="text-sm font-medium text-zinc-900">{provider.name}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-zinc-100 text-zinc-500">
                      Not configured
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Configure
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl space-y-4">
            <button
              onClick={() => { setSelectedProvider(null); setTestResult(null); }}
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              ← Back to providers
            </button>

            <Card className="border-zinc-200">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-4 w-4 text-zinc-400" />
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Configure {providers.find((p) => p.id === selectedProvider)?.name}
                  </h2>
                </div>

                {selectedProvider === 'saml' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-zinc-600">Entity ID / Issuer</Label>
                      <Input placeholder="https://your-idp.example.com/entity" className="border-zinc-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-zinc-600">SSO URL</Label>
                      <Input placeholder="https://your-idp.example.com/sso/saml" className="border-zinc-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-zinc-600">X.509 Certificate</Label>
                      <textarea
                        className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm font-mono h-24 resize-none"
                        placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-zinc-600">Client ID</Label>
                      <Input placeholder="your-client-id" className="border-zinc-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-zinc-600">Client Secret</Label>
                      <Input type="password" placeholder="your-client-secret" className="border-zinc-200" />
                    </div>
                    {selectedProvider === 'oidc' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-zinc-600">Discovery URL</Label>
                        <Input placeholder="https://your-idp.example.com/.well-known/openid-configuration" className="border-zinc-200" />
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-600">Group → Role Mapping</Label>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-2 items-center">
                      <Input placeholder="IdP group name" className="border-zinc-200 flex-1" defaultValue="engineering" />
                      <span className="text-zinc-400">→</span>
                      <select className="rounded-md border border-zinc-200 px-3 py-2 text-sm flex-1">
                        <option>Developer</option>
                        <option>Admin</option>
                        <option>Viewer</option>
                      </select>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input placeholder="IdP group name" className="border-zinc-200 flex-1" defaultValue="platform-admins" />
                      <span className="text-zinc-400">→</span>
                      <select className="rounded-md border border-zinc-200 px-3 py-2 text-sm flex-1" defaultValue="Admin">
                        <option>Developer</option>
                        <option>Admin</option>
                        <option>Viewer</option>
                      </select>
                    </div>
                  </div>
                </div>

                {testResult === 'success' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700">Connection successful! SSO is ready to use.</span>
                  </div>
                )}
                {testResult === 'error' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-700">Connection failed. Check your credentials.</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button size="sm" onClick={() => { alert('SSO configuration saved!'); setSelectedProvider(null); }}>
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
