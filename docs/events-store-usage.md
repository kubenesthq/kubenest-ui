# Events Store Usage Guide

## Overview

The Events Store (`store/events.ts`) is a Zustand-based state management solution for handling real-time Server-Sent Events (SSE) from the Kubenest backend. It provides comprehensive event tracking, filtering, and status management for workloads, projects, clusters, builds, and deployments.

## Features

- **Event Storage**: Configurable history size (default: 100 events)
- **Latest Event Tracking**: Fast access to most recent event per resource
- **Status Updates**: Convenient methods for updating resource status
- **Advanced Filtering**: Query events by type, resource, time range
- **Statistics**: Event counts and analytics
- **TypeScript Support**: Full type safety with comprehensive interfaces

## Core Types

### EventType
```typescript
type EventType =
  | 'workload.status' | 'workload.deployed' | 'workload.scaled' | 'workload.failed'
  | 'project.status' | 'project.created' | 'project.updated' | 'project.failed'
  | 'cluster.status' | 'cluster.connected' | 'cluster.disconnected'
  | 'build.started' | 'build.completed' | 'build.failed'
  | 'deployment.progress';
```

### ResourceType
```typescript
type ResourceType = 'workload' | 'project' | 'cluster' | 'build' | 'deployment';
```

### SSEEvent
```typescript
interface SSEEvent {
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
```

## Usage Examples

### Basic Event Management

```typescript
import { useEventsStore } from '@/store/events';

function MyComponent() {
  const addEvent = useEventsStore((state) => state.addEvent);
  const events = useEventsStore((state) => state.events);

  // Add a new event
  const handleNewEvent = (event: SSEEvent) => {
    addEvent(event);
  };

  // Clear all events
  const clearEvents = useEventsStore((state) => state.clearEvents);
  const handleClear = () => clearEvents();

  return (
    <div>
      <p>Total Events: {events.length}</p>
      <button onClick={handleClear}>Clear Events</button>
    </div>
  );
}
```

### Status Updates

```typescript
import { useEventsStore } from '@/store/events';

function WorkloadStatus({ workloadId }: { workloadId: string }) {
  const updateWorkloadStatus = useEventsStore((state) => state.updateWorkloadStatus);

  const handleDeploy = async () => {
    // Update status to "Deploying"
    updateWorkloadStatus(workloadId, 'Deploying', 'Building');

    // ... deployment logic ...

    // Update status to "Running"
    updateWorkloadStatus(workloadId, 'Running', 'Ready');
  };

  return <button onClick={handleDeploy}>Deploy</button>;
}
```

### Filtering Events

```typescript
import { useEventsStore } from '@/store/events';

function EventList({ resourceId }: { resourceId: string }) {
  // Get events for specific resource
  const getEventsFor = useEventsStore((state) => state.getEventsFor);
  const events = getEventsFor(resourceId);

  // Get events by type
  const getEventsByType = useEventsStore((state) => state.getEventsByType);
  const deploymentEvents = getEventsByType('workload.deployed');

  // Advanced filtering
  const getFilteredEvents = useEventsStore((state) => state.getFilteredEvents);
  const recentErrors = getFilteredEvents({
    type: 'workload.failed',
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  });

  return (
    <div>
      <h3>Events for Resource {resourceId}</h3>
      {events.map((event) => (
        <div key={event.id}>
          <span>{event.type}</span>
          <span>{event.data.message}</span>
        </div>
      ))}
    </div>
  );
}
```

### Using Utility Hooks

#### Resource Events Hook

```typescript
import { useResourceEvents } from '@/store/events';

function WorkloadEvents({ workloadId }: { workloadId: string }) {
  const { events, latest } = useResourceEvents('workload', workloadId);

  return (
    <div>
      <h4>Latest Status: {latest?.data.status}</h4>
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            {event.data.message} - {new Date(event.timestamp).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Event Statistics Hook

```typescript
import { useEventStats } from '@/store/events';

function EventsDashboard() {
  const { totalEvents, recentEvents, getCountByType } = useEventStats();

  return (
    <div>
      <h3>Event Statistics</h3>
      <p>Total Events: {totalEvents}</p>
      <p>Failed Deployments: {getCountByType('workload.failed')}</p>
      <p>Successful Deployments: {getCountByType('workload.deployed')}</p>

      <h4>Recent Events</h4>
      <ul>
        {recentEvents.map((event) => (
          <li key={event.id}>{event.data.message}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Integration with SSE Hook

```typescript
import { useEffect } from 'react';
import { useEventsStore } from '@/store/events';
import type { SSEEvent } from '@/store/events';

function useSSEIntegration() {
  const addEvent = useEventsStore((state) => state.addEvent);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      const sseEvent: SSEEvent = JSON.parse(event.data);
      addEvent(sseEvent);
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };

    return () => {
      eventSource.close();
    };
  }, [addEvent]);
}
```

### Cleanup Old Events

```typescript
import { useEventsStore } from '@/store/events';

function EventCleanup() {
  const clearOldEvents = useEventsStore((state) => state.clearOldEvents);

  useEffect(() => {
    // Clear events older than 1 hour every minute
    const interval = setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      clearOldEvents(oneHourAgo);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [clearOldEvents]);

  return null;
}
```

### Configuring History Size

```typescript
import { useEventsStore } from '@/store/events';

function EventConfiguration() {
  const setMaxHistorySize = useEventsStore((state) => state.setMaxHistorySize);

  // Increase history size to 500 events
  useEffect(() => {
    setMaxHistorySize(500);
  }, [setMaxHistorySize]);

  return null;
}
```

## API Reference

### State Properties

- `events: SSEEvent[]` - Array of all stored events
- `latestByResource: Map<string, SSEEvent>` - Latest event for each resource
- `maxHistorySize: number` - Maximum number of events to store (default: 100)

### Event Management Methods

- `addEvent(event: SSEEvent)` - Add a single event
- `addEvents(events: SSEEvent[])` - Add multiple events in batch
- `clearEvents()` - Remove all events
- `clearOldEvents(olderThan: Date)` - Remove events older than specified date

### Status Update Methods

- `updateWorkloadStatus(id: string, status: string, phase?: string)` - Update workload status
- `updateProjectStatus(id: string, status: string, phase?: string)` - Update project status
- `updateClusterStatus(id: string, status: 'healthy' | 'degraded' | 'offline')` - Update cluster status

### Query Methods

- `getEventsFor(resourceId: string): SSEEvent[]` - Get all events for a resource
- `getEventsByType(type: EventType): SSEEvent[]` - Get events by event type
- `getEventsByResourceType(resourceType: ResourceType): SSEEvent[]` - Get events by resource type
- `getFilteredEvents(filter: EventFilter): SSEEvent[]` - Advanced filtering
- `getLatestEvent(resourceId: string): SSEEvent | undefined` - Get latest event for resource

### Statistics Methods

- `getEventCount(): number` - Get total event count
- `getEventCountByType(type: EventType): number` - Count events by type
- `getRecentEvents(limit: number): SSEEvent[]` - Get N most recent events

### Configuration Methods

- `setMaxHistorySize(size: number)` - Set maximum history size

## Best Practices

1. **Memory Management**: Use `clearOldEvents()` periodically to prevent memory growth
2. **Batch Operations**: Use `addEvents()` when adding multiple events at once
3. **Selective Subscriptions**: Subscribe only to needed store slices to prevent unnecessary re-renders
4. **Utility Hooks**: Use `useResourceEvents` and `useEventStats` for common patterns
5. **Error Handling**: Always handle event parsing errors when integrating with SSE
6. **Type Safety**: Use the provided TypeScript types to ensure type safety

## Integration Points

1. **SSE Connection** (`hooks/useSSE.ts`) - Receives events from backend
2. **Dashboard Components** - Display real-time status updates
3. **Resource Detail Pages** - Show event history per resource
4. **Notification System** - Trigger toast notifications on events
5. **Analytics** - Track deployment success rates and performance metrics

## Performance Considerations

- Default history limit of 100 events prevents memory issues
- `latestByResource` Map provides O(1) access to latest events
- Event filtering is performed in-memory (efficient for 100-500 events)
- For larger datasets, consider implementing pagination or server-side filtering
