# SSE Integration Documentation

## Overview

Server-Sent Events (SSE) integration has been implemented to enable real-time event streaming from the backend to the frontend UI.

## Architecture

```
Backend API → SSE Stream → useSSE Hook → Events Store → EventToast Component
                              ↓
                         SSEProvider (Global)
                              ↓
                        App Layout (Root)
```

## Components

### 1. **SSEProvider** (`components/providers/SSEProvider.tsx`)

Global provider component that establishes and manages the SSE connection.

**Features:**
- Automatically connects when user is authenticated
- Disconnects when user logs out
- Subscribes to all event types by default
- Integrates with EventToast for notifications
- Logs connection status for debugging

**Integration:**
Already integrated into `app/providers.tsx` and wraps the entire application.

### 2. **useSSE Hook** (`hooks/useSSE.ts`)

Existing hook that manages the EventSource connection with comprehensive features:

**Features:**
- Auto-reconnect with exponential backoff
- Event filtering by cluster_id, project_id, workload_id, resource_type
- Connection state management
- Token-based authentication
- Event buffering (keeps last 100 events)

**Event Types:**
- `connected` - Initial connection established
- `heartbeat` - Keep-alive events
- `workload_status_update` - Workload state changes
- `project_status_update` - Project state changes
- `cluster_status_update` - Cluster state changes
- `build_complete` - Build finished successfully
- `build_failed` - Build failed
- `error_report` - Error events

### 3. **EventToast** (`components/notifications/EventToast.tsx`)

Component that displays toast notifications for SSE events.

**Features:**
- Processes SSE events and creates user-friendly notifications
- Visual indicators (icons) for different event types
- Auto-dismissal after configurable duration
- Success, error, info, and warning variants

### 4. **Events Store** (`store/events.ts`)

Zustand store for managing SSE events and connection state.

**API:**
```typescript
interface EventsState {
  events: SSEEvent[];
  connection: SSEConnectionState;

  addEvent: (event: SSEEvent) => void;
  clearEvents: () => void;
  setConnectionState: (state: Partial<SSEConnectionState>) => void;
  getEventsByType: (type: string) => SSEEvent[];
  getEventsByResource: (resourceId: string) => SSEEvent[];
}
```

### 5. **Event Types** (`types/events.ts`)

TypeScript definitions for SSE events.

```typescript
export type EventType =
  | 'cluster.connected'
  | 'cluster.disconnected'
  | 'project.created'
  | 'workload.running'
  | 'build.completed'
  // ... more event types

export interface SSEEvent {
  id: string;
  type: EventType;
  timestamp: string;
  data: Record<string, any>;
  clusterId?: string;
  projectId?: string;
  workloadId?: string;
}
```

## Usage

### Global Events (Already Configured)

SSEProvider is already integrated at the root level and automatically connects when users log in.

### Page-Specific Events

To listen for specific events on a page:

```tsx
'use client';

import { useSSE } from '@/hooks/useSSE';

export default function WorkloadPage({ params }) {
  const { events, lastEvent, connected } = useSSE({
    project_id: params.projectId,
    resource_type: 'workload'
  });

  useEffect(() => {
    if (lastEvent?.event_type === 'workload_status_update') {
      // Handle workload status change
      console.log('Workload updated:', lastEvent);
    }
  }, [lastEvent]);

  return (
    <div>
      <p>Connection: {connected ? 'Connected' : 'Disconnected'}</p>
      {/* Your UI */}
    </div>
  );
}
```

### Direct Store Access

Access events from anywhere using the Zustand store:

```tsx
import { useEventsStore } from '@/store/events';

function MyComponent() {
  const events = useEventsStore((state) => state.events);
  const workloadEvents = useEventsStore((state) =>
    state.getEventsByType('workload_status_update')
  );

  return <div>{/* Use events */}</div>;
}
```

## Backend Requirements

The backend must implement an SSE endpoint at:

```
GET /api/v1/events/stream
```

**Authentication:**
- Token passed as query parameter: `?token={jwt_token}`

**Event Format:**
```
event: workload_status_update
data: {"event_type":"workload_status_update","timestamp":1234567890,"workload_id":"wl-123",...}

event: heartbeat
data: {"event_type":"heartbeat","timestamp":1234567890}
```

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Connection Parameters

Default values in `useSSE`:
- Initial retry delay: 1 second
- Max retry delay: 30 seconds
- Max retry attempts: 10
- Max events buffered: 100

## Testing

To test the SSE integration:

1. Start the backend API with SSE endpoint
2. Log in to the UI
3. Open browser DevTools → Network tab → Filter by "EventSource"
4. Trigger events from backend (create workload, etc.)
5. Check console logs for `[SSE]` messages
6. Verify toast notifications appear

## Troubleshooting

### Connection Issues

Check console for `[SSE]` logs:
- `Connected to event stream` - Success
- `Connection error` - Check network/CORS
- `Max reconnection attempts reached` - Backend unavailable

### Missing Notifications

1. Verify user is authenticated
2. Check EventToast is rendering (should see `[EventToast]` logs)
3. Verify event types match expected values
4. Check browser notification permissions

### Performance

If too many events cause performance issues:
- Reduce MAX_EVENTS in useSSE
- Add more aggressive filtering
- Debounce toast notifications
- Consider pagination for event history

## Future Enhancements

- [ ] Replace console logging with proper toast library (react-hot-toast/sonner)
- [ ] Add event persistence (IndexedDB)
- [ ] Implement event replay from specific timestamp
- [ ] Add event acknowledgment system
- [ ] Support for event priorities
- [ ] Add metrics dashboard for event stats
