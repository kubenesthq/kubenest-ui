'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ClustersPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Clusters</h1>
        <Button>Add Cluster</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your Clusters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No clusters yet. Add your first cluster to get started.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
