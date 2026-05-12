'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Cloud } from 'lucide-react';
import Link from 'next/link';
import { getCloudCredentials } from '@/api/cloud-credentials';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrg } from '@/hooks/useOrganization';
import { CLOUD_PROVIDERS } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function CloudProvidersPage() {
  const { isAuthenticated } = useAuth(true);
  const { orgId } = useCurrentOrg();
  const credsQ = useQuery({
    queryKey: ['cloud-credentials', orgId],
    queryFn: () => getCloudCredentials(orgId!),
    enabled: !!orgId,
  });
  if (!isAuthenticated) return null;

  const countFor = (id: string) => (credsQ.data?.data ?? []).filter((c) => (c.provider ?? '').toLowerCase() === id).length;

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Cloud providers</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Manage cloud-provider credentials for cluster provisioning. The wired provider can provision clusters today; the rest accept credentials (shape-validated) but provisioning is coming soon — no pseudo-success path.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="providers-list">
        {CLOUD_PROVIDERS.map((p) => {
          const n = countFor(p.id);
          return (
            <Link key={p.id} href={`/settings/cloud-credentials/${p.id}`} data-testid={`provider-card-${p.id}`}>
              <Card className="border-zinc-200 hover:border-zinc-300 transition-colors">
                <CardContent className="pt-5 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${p.wired ? 'bg-orange-100' : 'bg-zinc-200'}`}>
                      <Cloud className={`h-5 w-5 ${p.wired ? 'text-orange-600' : 'text-zinc-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900">{p.label}</p>
                        {p.wired
                          ? <Badge className="bg-emerald-100 text-emerald-700 font-normal text-[11px]">Wired</Badge>
                          : <Badge className="bg-zinc-200 text-zinc-600 font-normal text-[11px]" data-testid={`provider-card-${p.id}-coming-soon`}>Coming soon</Badge>}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 font-mono">{p.id} · {n} credential{n === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
