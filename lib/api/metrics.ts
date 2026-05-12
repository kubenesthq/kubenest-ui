import { apiClient } from '../api-client';
import type { MetricsRange, MetricsSeriesResponse } from '@/types/api';

export const metricsApi = {
  // Cluster-capacity time-series (C6 envelope).
  cluster: (id: string, range: MetricsRange = '1h') =>
    apiClient.get<MetricsSeriesResponse>(`/clusters/${id}/metrics?range=${range}`),

  // App + per-component + cluster-capacity time-series for an app.
  app: (namespace: string, name: string, projectId: string, range: MetricsRange = '1h') =>
    apiClient.get<MetricsSeriesResponse>(
      `/apps/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/metrics?project_id=${projectId}&range=${range}`,
    ),
};
