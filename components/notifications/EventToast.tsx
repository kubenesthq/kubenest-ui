'use client';

import * as React from 'react';
import { useSSE, type SSEEvent } from '@/hooks/useSSE';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastNotification {
  id: string;
  title: string;
  description: string;
  variant: 'success' | 'error' | 'info' | 'warning';
  icon: React.ReactNode;
  duration?: number;
}

// SSE events are loosely-typed wire data; pull values from either the event
// itself or its `data` envelope, accepting only the shapes we actually use.
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function envelope(event: SSEEvent): Record<string, unknown> {
  const d = (event as Record<string, unknown>).data;
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
}
function eventKind(event: SSEEvent): string {
  return str((event as Record<string, unknown>).type) ?? str(event.event_type) ?? '';
}

function processEvent(event: SSEEvent): ToastNotification | null {
  const id = `toast-${Date.now()}`;
  const e = event as Record<string, unknown>;
  const data = envelope(event);
  const kind = eventKind(event);

  // Workload status changes
  if (kind === 'workload_status') {
    const status = str(data.status) ?? str(e.status);
    const workloadName = str(data.name) ?? str(e.name) ?? 'Workload';
    switch (status?.toLowerCase()) {
      case 'running':
        return { id, title: 'Workload Running', description: `${workloadName} is now running successfully`, variant: 'success', icon: <CheckCircle2 className="h-5 w-5" /> };
      case 'failed':
        return { id, title: 'Workload Failed', description: `${workloadName} failed to start`, variant: 'error', icon: <XCircle className="h-5 w-5" /> };
      case 'pending':
        return { id, title: 'Workload Pending', description: `${workloadName} is being prepared`, variant: 'info', icon: <Info className="h-5 w-5" /> };
      case 'building':
        return { id, title: 'Building Workload', description: `${workloadName} is being built`, variant: 'info', icon: <Info className="h-5 w-5" /> };
      case 'deploying':
        return { id, title: 'Deploying Workload', description: `${workloadName} is being deployed`, variant: 'info', icon: <Info className="h-5 w-5" /> };
      case 'degraded':
        return { id, title: 'Workload Degraded', description: `${workloadName} is running with issues`, variant: 'warning', icon: <AlertTriangle className="h-5 w-5" /> };
    }
  }

  // Build completion events
  if (kind === 'build_complete') {
    const successRaw = data.success ?? e.success;
    const success = typeof successRaw === 'boolean' ? successRaw : true;
    const buildName = str(data.name) ?? str(e.name) ?? 'Build';
    return success
      ? { id, title: 'Build Complete', description: `${buildName} completed successfully`, variant: 'success', icon: <CheckCircle2 className="h-5 w-5" /> }
      : { id, title: 'Build Failed', description: `${buildName} failed to complete`, variant: 'error', icon: <XCircle className="h-5 w-5" /> };
  }

  // Project status changes
  if (kind === 'project_status') {
    const status = str(data.status) ?? str(e.status);
    const projectName = str(data.name) ?? str(e.name) ?? 'Project';
    switch (status?.toLowerCase()) {
      case 'ready':
        return { id, title: 'Project Ready', description: `${projectName} is ready to use`, variant: 'success', icon: <CheckCircle2 className="h-5 w-5" /> };
      case 'creating':
        return { id, title: 'Creating Project', description: `${projectName} is being created`, variant: 'info', icon: <Info className="h-5 w-5" /> };
      case 'error':
        return { id, title: 'Project Error', description: `${projectName} encountered an error`, variant: 'error', icon: <XCircle className="h-5 w-5" /> };
    }
  }

  // Deployment events
  if (kind === 'deployment_ready') {
    const name = str(data.name) ?? str(e.name) ?? 'Deployment';
    return { id, title: 'Deployment Ready', description: `${name} is ready and accessible`, variant: 'success', icon: <CheckCircle2 className="h-5 w-5" /> };
  }

  // Error events
  if (kind === 'error_report') {
    const message = str(data.message) ?? str(e.message) ?? 'An error occurred';
    return { id, title: 'Error', description: message, variant: 'error', icon: <XCircle className="h-5 w-5" />, duration: 7000 };
  }

  return null;
}

export function EventToast() {
  const [toasts, setToasts] = React.useState<ToastNotification[]>([]);
  const { lastEvent } = useSSE(); // no filters — receive all events

  // Process SSE events into toast notifications.
  React.useEffect(() => {
    if (!lastEvent) return;
    const notification = processEvent(lastEvent);
    if (!notification) return;
    setToasts((prev) => [...prev, notification]);
    // Auto-dismiss after the notification's duration (default 5s).
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== notification.id));
    }, notification.duration || 5000);
  }, [lastEvent]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((toast) => (
        <Toast key={toast.id} variant={toast.variant} duration={toast.duration || 5000}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">{toast.icon}</div>
            <div className="flex-1 grid gap-1">
              <ToastTitle>{toast.title}</ToastTitle>
              <ToastDescription>{toast.description}</ToastDescription>
            </div>
          </div>
          <ToastClose onClick={() => removeToast(toast.id)} />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
