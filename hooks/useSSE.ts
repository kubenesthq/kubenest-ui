'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';

// SSE Event Types
export type SSEEventType =
  | 'connected'
  | 'heartbeat'
  | 'workload_status_update'
  | 'addon_status_update'
  | 'project_status_update'
  | 'cluster_status_update'
  | 'build_complete'
  | 'build_failed'
  | 'error_report';

// Base event interface
export interface SSEEvent {
  event_type: SSEEventType;
  timestamp: number;
  [key: string]: any;
}

// Specific event types
export interface ConnectedEvent extends SSEEvent {
  event_type: 'connected';
  connection_id: string;
}

export interface HeartbeatEvent extends SSEEvent {
  event_type: 'heartbeat';
}

export interface WorkloadStatusEvent extends SSEEvent {
  event_type: 'workload_status_update';
  resource_type: 'workload';
  workload_id: string;
  project_id: string;
  status: 'Pending' | 'Building' | 'Deploying' | 'Running' | 'Degraded' | 'Failed';
  message: string;
  replicas?: number;
  available_replicas?: number;
}

export interface ProjectStatusEvent extends SSEEvent {
  event_type: 'project_status_update';
  resource_type: 'project';
  project_id: string;
  cluster_id: string;
  status: 'Pending' | 'Creating' | 'Ready' | 'Deleting' | 'Error';
  message: string;
}

export interface ClusterStatusEvent extends SSEEvent {
  event_type: 'cluster_status_update';
  resource_type: 'cluster';
  cluster_id: string;
  status: 'healthy' | 'unhealthy';
  kubernetes_version?: string;
  node_count?: number;
}

export interface BuildCompleteEvent extends SSEEvent {
  event_type: 'build_complete';
  resource_type: 'build';
  build_id: string;
  workload_id: string;
  image_digest: string;
  build_duration: number;
  message: string;
}

export interface BuildFailedEvent extends SSEEvent {
  event_type: 'build_failed';
  resource_type: 'build';
  build_id: string;
  workload_id: string;
  error: string;
}

export interface ErrorReportEvent extends SSEEvent {
  event_type: 'error_report';
  error_type: string;
  message: string;
  resource_id?: string;
}

// Filter options
export interface SSEFilters {
  cluster_id?: string;
  project_id?: string;
  workload_id?: string;
  resource_type?: 'cluster' | 'project' | 'workload' | 'build' | 'addon' | 'all';
}

// Hook return type
export interface UseSSEReturn {
  events: SSEEvent[];
  lastEvent: SSEEvent | null;
  connected: boolean;
  error: Error | null;
  reconnecting: boolean;
  connectionId: string | null;
  clearEvents: () => void;
}

// Configuration
const SSE_ENDPOINT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const MAX_EVENTS = 100; // Keep last 100 events in memory
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 10;

/**
 * React hook for Server-Sent Events connection with auto-reconnect
 *
 * @param filters - Optional filters for events (cluster_id, project_id, workload_id, resource_type)
 * @param enabled - Whether the SSE connection should be active (default: true)
 * @returns Object containing events array, connection state, and utility functions
 *
 * @example
 * ```tsx
 * const { events, connected, error, reconnecting } = useSSE({
 *   resource_type: 'workload',
 *   project_id: 'proj-123'
 * });
 *
 * useEffect(() => {
 *   events.forEach(event => {
 *     if (event.event_type === 'workload_status_update') {
 *       console.log('Workload update:', event);
 *     }
 *   });
 * }, [events]);
 * ```
 */
export function useSSE(filters?: SSEFilters, enabled: boolean = true): UseSSEReturn {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);

  const token = useAuthStore((state) => state.token);

  // Build URL with filters
  const buildURL = useCallback(() => {
    const params = new URLSearchParams();
    if (filters?.cluster_id) params.append('cluster_id', filters.cluster_id);
    if (filters?.project_id) params.append('project_id', filters.project_id);
    if (filters?.workload_id) params.append('workload_id', filters.workload_id);
    if (filters?.resource_type) params.append('resource_type', filters.resource_type);

    const queryString = params.toString();
    const url = `${SSE_ENDPOINT}/api/v1/events/stream${queryString ? `?${queryString}` : ''}`;

    return url;
  }, [filters]);

  // Add event to list
  const addEvent = useCallback((event: SSEEvent) => {
    setLastEvent(event);
    setEvents((prev) => {
      const updated = [...prev, event];
      // Keep only last MAX_EVENTS
      return updated.slice(-MAX_EVENTS);
    });
  }, []);

  // Clear all events
  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  // Calculate exponential backoff delay
  const getRetryDelay = useCallback(() => {
    const delay = Math.min(
      retryDelayRef.current * Math.pow(2, retryCountRef.current),
      MAX_RETRY_DELAY
    );
    return delay + Math.random() * 1000; // Add jitter
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!enabled || !token) {
      return;
    }

    try {
      const url = buildURL();

      // Note: EventSource doesn't support custom headers in browser
      // We need to pass the token as a query parameter or use a custom implementation
      // For production, consider using fetch with ReadableStream for better control

      // For now, we'll append token to URL (backend needs to support this)
      const authenticatedURL = `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

      const eventSource = new EventSource(authenticatedURL);
      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.onopen = () => {
        setConnected(true);
        setReconnecting(false);
        setError(null);
        retryCountRef.current = 0;
        retryDelayRef.current = INITIAL_RETRY_DELAY;
      };

      // Handle 'connected' event
      eventSource.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data) as ConnectedEvent;
        setConnectionId(data.connection_id);
        addEvent(data);
      });

      // Handle 'heartbeat' event
      eventSource.addEventListener('heartbeat', (e) => {
        const data = JSON.parse(e.data) as HeartbeatEvent;
        // Don't add heartbeats to events array to avoid clutter
        // But we could use them for connection health monitoring
      });

      // Handle 'workload_status_update' event
      eventSource.addEventListener('workload_status_update', (e) => {
        const data = JSON.parse(e.data) as WorkloadStatusEvent;
        addEvent(data);
      });

      // Handle 'addon_status_update' event
      eventSource.addEventListener('addon_status_update', (e) => {
        const data = JSON.parse(e.data) as SSEEvent;
        addEvent(data);
      });

      // Handle 'project_status_update' event
      eventSource.addEventListener('project_status_update', (e) => {
        const data = JSON.parse(e.data) as ProjectStatusEvent;
        addEvent(data);
      });

      // Handle 'cluster_status_update' event
      eventSource.addEventListener('cluster_status_update', (e) => {
        const data = JSON.parse(e.data) as ClusterStatusEvent;
        addEvent(data);
      });

      // Handle 'build_complete' event
      eventSource.addEventListener('build_complete', (e) => {
        const data = JSON.parse(e.data) as BuildCompleteEvent;
        addEvent(data);
      });

      // Handle 'build_failed' event
      eventSource.addEventListener('build_failed', (e) => {
        const data = JSON.parse(e.data) as BuildFailedEvent;
        addEvent(data);
      });

      // Handle 'error_report' event
      eventSource.addEventListener('error_report', (e) => {
        const data = JSON.parse(e.data) as ErrorReportEvent;
        addEvent(data);
      });

      // Connection error or closed
      eventSource.onerror = (e) => {
        setConnected(false);

        // Only attempt reconnect if not manually closed and within retry limit
        if (eventSource.readyState === EventSource.CLOSED) {
          if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
            setReconnecting(true);
            const delay = getRetryDelay();

            retryTimeoutRef.current = setTimeout(() => {
              retryCountRef.current += 1;
              connect();
            }, delay);
          } else {
            setError(new Error('Max reconnection attempts reached'));
            setReconnecting(false);
          }
        }
      };

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect to SSE endpoint'));
      setConnected(false);
    }
  }, [enabled, token, buildURL, addEvent, getRetryDelay]);

  // Disconnect from SSE endpoint
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setConnected(false);
    setReconnecting(false);
    setConnectionId(null);
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // Reconnect when filters change
  useEffect(() => {
    if (connected) {
      disconnect();
      connect();
    }
  }, [filters?.cluster_id, filters?.project_id, filters?.workload_id, filters?.resource_type]);

  return {
    events,
    lastEvent,
    connected,
    error,
    reconnecting,
    connectionId,
    clearEvents,
  };
}
