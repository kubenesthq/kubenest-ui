import { create } from 'zustand';
import type { Workload, Project, Cluster } from '@/types/api';

// SSE Event types
export type EventType =
  | 'workload.status'
  | 'workload.deployed'
  | 'workload.scaled'
  | 'workload.failed'
  | 'project.status'
  | 'project.created'
  | 'project.updated'
  | 'project.failed'
  | 'cluster.status'
  | 'cluster.connected'
  | 'cluster.disconnected'
  | 'build.started'
  | 'build.completed'
  | 'build.failed'
  | 'deployment.progress';

export type ResourceType = 'workload' | 'project' | 'cluster' | 'build' | 'deployment';

export interface SSEEvent {
  id: string;
  type: EventType;
  resourceType: ResourceType;
  resourceId: string;
  timestamp: string;
  data: {
    status?: string;
    phase?: string;
    message?: string;
    progress?: number;
    url?: string;
    error?: string;
    details?: Record<string, unknown>;
    // Resource-specific data
    workload?: Partial<Workload>;
    project?: Partial<Project>;
    cluster?: Partial<Cluster>;
  };
  metadata?: {
    clusterId?: string;
    projectId?: string;
    workloadId?: string;
    userId?: string;
  };
}

interface EventFilter {
  resourceType?: ResourceType;
  resourceId?: string;
  type?: EventType;
  startTime?: Date;
  endTime?: Date;
}

interface EventsState {
  // Event storage
  events: SSEEvent[];
  latestByResource: Map<string, SSEEvent>;
  maxHistorySize: number;

  // Event management
  addEvent: (event: SSEEvent) => void;
  addEvents: (events: SSEEvent[]) => void;
  clearEvents: () => void;
  clearOldEvents: (olderThan: Date) => void;

  // Status updates
  updateWorkloadStatus: (id: string, status: string, phase?: string) => void;
  updateProjectStatus: (id: string, status: string, phase?: string) => void;
  updateClusterStatus: (id: string, status: 'healthy' | 'degraded' | 'offline') => void;

  // Event queries
  getEventsFor: (resourceId: string) => SSEEvent[];
  getEventsByType: (type: EventType) => SSEEvent[];
  getEventsByResourceType: (resourceType: ResourceType) => SSEEvent[];
  getFilteredEvents: (filter: EventFilter) => SSEEvent[];
  getLatestEvent: (resourceId: string) => SSEEvent | undefined;

  // Statistics
  getEventCount: () => number;
  getEventCountByType: (type: EventType) => number;
  getRecentEvents: (limit: number) => SSEEvent[];

  // Configuration
  setMaxHistorySize: (size: number) => void;
}

// Helper to generate resource key for latest event tracking
const getResourceKey = (resourceType: ResourceType, resourceId: string): string => {
  return `${resourceType}:${resourceId}`;
};

// Helper to create status update event
const createStatusEvent = (
  resourceType: ResourceType,
  resourceId: string,
  eventType: EventType,
  status: string,
  phase?: string
): SSEEvent => {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: eventType,
    resourceType,
    resourceId,
    timestamp: new Date().toISOString(),
    data: {
      status,
      phase,
      message: `${resourceType} status updated to ${status}${phase ? ` (${phase})` : ''}`,
    },
  };
};

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  latestByResource: new Map(),
  maxHistorySize: 100,

  addEvent: (event: SSEEvent) => {
    set((state) => {
      // Enforce max history size
      let newEvents = [...state.events, event];
      if (newEvents.length > state.maxHistorySize) {
        newEvents = newEvents.slice(newEvents.length - state.maxHistorySize);
      }

      // Update latest by resource
      const resourceKey = getResourceKey(event.resourceType, event.resourceId);
      const newLatestByResource = new Map(state.latestByResource);
      newLatestByResource.set(resourceKey, event);

      return {
        events: newEvents,
        latestByResource: newLatestByResource,
      };
    });
  },

  addEvents: (events: SSEEvent[]) => {
    set((state) => {
      // Add all events
      let newEvents = [...state.events, ...events];

      // Enforce max history size
      if (newEvents.length > state.maxHistorySize) {
        newEvents = newEvents.slice(newEvents.length - state.maxHistorySize);
      }

      // Update latest by resource for all events
      const newLatestByResource = new Map(state.latestByResource);
      events.forEach((event) => {
        const resourceKey = getResourceKey(event.resourceType, event.resourceId);
        const existing = newLatestByResource.get(resourceKey);

        // Only update if this event is newer
        if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
          newLatestByResource.set(resourceKey, event);
        }
      });

      return {
        events: newEvents,
        latestByResource: newLatestByResource,
      };
    });
  },

  clearEvents: () => {
    set({
      events: [],
      latestByResource: new Map(),
    });
  },

  clearOldEvents: (olderThan: Date) => {
    set((state) => {
      const newEvents = state.events.filter(
        (event) => new Date(event.timestamp) >= olderThan
      );

      // Rebuild latest by resource map
      const newLatestByResource = new Map<string, SSEEvent>();
      newEvents.forEach((event) => {
        const resourceKey = getResourceKey(event.resourceType, event.resourceId);
        const existing = newLatestByResource.get(resourceKey);

        if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
          newLatestByResource.set(resourceKey, event);
        }
      });

      return {
        events: newEvents,
        latestByResource: newLatestByResource,
      };
    });
  },

  updateWorkloadStatus: (id: string, status: string, phase?: string) => {
    const event = createStatusEvent('workload', id, 'workload.status', status, phase);
    get().addEvent(event);
  },

  updateProjectStatus: (id: string, status: string, phase?: string) => {
    const event = createStatusEvent('project', id, 'project.status', status, phase);
    get().addEvent(event);
  },

  updateClusterStatus: (id: string, status: 'healthy' | 'degraded' | 'offline') => {
    const event = createStatusEvent('cluster', id, 'cluster.status', status);
    get().addEvent(event);
  },

  getEventsFor: (resourceId: string) => {
    return get().events.filter((event) => event.resourceId === resourceId);
  },

  getEventsByType: (type: EventType) => {
    return get().events.filter((event) => event.type === type);
  },

  getEventsByResourceType: (resourceType: ResourceType) => {
    return get().events.filter((event) => event.resourceType === resourceType);
  },

  getFilteredEvents: (filter: EventFilter) => {
    return get().events.filter((event) => {
      // Resource type filter
      if (filter.resourceType && event.resourceType !== filter.resourceType) {
        return false;
      }

      // Resource ID filter
      if (filter.resourceId && event.resourceId !== filter.resourceId) {
        return false;
      }

      // Event type filter
      if (filter.type && event.type !== filter.type) {
        return false;
      }

      // Time range filter
      const eventTime = new Date(event.timestamp);
      if (filter.startTime && eventTime < filter.startTime) {
        return false;
      }
      if (filter.endTime && eventTime > filter.endTime) {
        return false;
      }

      return true;
    });
  },

  getLatestEvent: (resourceId: string) => {
    const events = get().getEventsFor(resourceId);
    if (events.length === 0) return undefined;

    return events.reduce((latest, event) => {
      return new Date(event.timestamp) > new Date(latest.timestamp) ? event : latest;
    });
  },

  getEventCount: () => {
    return get().events.length;
  },

  getEventCountByType: (type: EventType) => {
    return get().events.filter((event) => event.type === type).length;
  },

  getRecentEvents: (limit: number) => {
    const events = get().events;
    return events.slice(-limit);
  },

  setMaxHistorySize: (size: number) => {
    set((state) => {
      let newEvents = state.events;
      if (newEvents.length > size) {
        newEvents = newEvents.slice(newEvents.length - size);
      }

      return {
        maxHistorySize: size,
        events: newEvents,
      };
    });
  },
}));

// Utility hook for subscribing to specific resource events
export const useResourceEvents = (resourceType: ResourceType, resourceId?: string) => {
  const getEventsFor = useEventsStore((state) => state.getEventsFor);
  const getEventsByResourceType = useEventsStore((state) => state.getEventsByResourceType);
  const getLatestEvent = useEventsStore((state) => state.getLatestEvent);

  if (resourceId) {
    return {
      events: getEventsFor(resourceId),
      latest: getLatestEvent(resourceId),
    };
  }

  return {
    events: getEventsByResourceType(resourceType),
    latest: undefined,
  };
};

// Utility hook for event statistics
export const useEventStats = () => {
  const getEventCount = useEventsStore((state) => state.getEventCount);
  const getEventCountByType = useEventsStore((state) => state.getEventCountByType);
  const getRecentEvents = useEventsStore((state) => state.getRecentEvents);

  return {
    totalEvents: getEventCount(),
    recentEvents: getRecentEvents(10),
    getCountByType: getEventCountByType,
  };
};
