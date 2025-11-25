/**
 * Event types for Server-Sent Events (SSE)
 */

export type EventType =
  | 'cluster.connected'
  | 'cluster.disconnected'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'workload.deploying'
  | 'workload.running'
  | 'workload.failed'
  | 'workload.scaled'
  | 'addon.installing'
  | 'addon.ready'
  | 'addon.failed'
  | 'build.started'
  | 'build.completed'
  | 'build.failed';

export interface SSEEvent {
  id: string;
  type: EventType;
  timestamp: string;
  data: Record<string, any>;
  clusterId?: string;
  projectId?: string;
  workloadId?: string;
  addonId?: string;
}

export interface SSEConnectionState {
  isConnected: boolean;
  lastEventId: string | null;
  error: string | null;
  reconnectAttempts: number;
}
