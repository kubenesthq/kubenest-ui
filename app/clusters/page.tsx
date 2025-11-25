'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClustersPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard as clusters view is now integrated there
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse">Redirecting...</div>
    </div>
  );
}
