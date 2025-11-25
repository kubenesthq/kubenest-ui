'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Cluster {
  id: string;
  name: string;
}

interface ClusterFilterProps {
  clusters: Cluster[];
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
}

export function ClusterFilter({ clusters, value, onChange, isLoading }: ClusterFilterProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={isLoading}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Filter by cluster" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Clusters</SelectItem>
        {clusters.map((cluster) => (
          <SelectItem key={cluster.id} value={cluster.id}>
            {cluster.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
