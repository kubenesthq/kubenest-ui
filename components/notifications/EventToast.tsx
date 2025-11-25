'use client';

import * as React from 'react';
import { useSSE } from '@/hooks/useSSE';
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

export function EventToast() {
  const [toasts, setToasts] = React.useState<ToastNotification[]>([]);
  const { lastEvent } = useSSE(); // Use hook without filters to get all events

  // Process SSE events and create toast notifications
  React.useEffect(() => {
    if (!lastEvent) return;

    const notification = processEvent(lastEvent);
    if (notification) {
      setToasts((prev) => [...prev, notification]);

      // Auto-dismiss after duration (default 5 seconds)
      const duration = notification.duration || 5000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notification.id));
      }, duration);
    }
  }, [lastEvent]);

  const processEvent = (event: any): ToastNotification | null => {
    const timestamp = Date.now();
    const id = `toast-${timestamp}`;

    // Process workload status changes
    if (event.type === 'workload_status' || event.event_type === 'workload_status') {
      const status = event.data?.status || event.status;
      const workloadName = event.data?.name || event.name || 'Workload';

      switch (status?.toLowerCase()) {
        case 'running':
          return {
            id,
            title: 'Workload Running',
            description: `${workloadName} is now running successfully`,
            variant: 'success',
            icon: <CheckCircle2 className="h-5 w-5" />,
          };
        case 'failed':
          return {
            id,
            title: 'Workload Failed',
            description: `${workloadName} failed to start`,
            variant: 'error',
            icon: <XCircle className="h-5 w-5" />,
          };
        case 'pending':
          return {
            id,
            title: 'Workload Pending',
            description: `${workloadName} is being prepared`,
            variant: 'info',
            icon: <Info className="h-5 w-5" />,
          };
        case 'building':
          return {
            id,
            title: 'Building Workload',
            description: `${workloadName} is being built`,
            variant: 'info',
            icon: <Info className="h-5 w-5" />,
          };
        case 'deploying':
          return {
            id,
            title: 'Deploying Workload',
            description: `${workloadName} is being deployed`,
            variant: 'info',
            icon: <Info className="h-5 w-5" />,
          };
        case 'degraded':
          return {
            id,
            title: 'Workload Degraded',
            description: `${workloadName} is running with issues`,
            variant: 'warning',
            icon: <AlertTriangle className="h-5 w-5" />,
          };
      }
    }

    // Process build completion events
    if (event.type === 'build_complete' || event.event_type === 'build_complete') {
      const success = event.data?.success ?? event.success ?? true;
      const buildName = event.data?.name || event.name || 'Build';

      if (success) {
        return {
          id,
          title: 'Build Complete',
          description: `${buildName} completed successfully`,
          variant: 'success',
          icon: <CheckCircle2 className="h-5 w-5" />,
        };
      } else {
        return {
          id,
          title: 'Build Failed',
          description: `${buildName} failed to complete`,
          variant: 'error',
          icon: <XCircle className="h-5 w-5" />,
        };
      }
    }

    // Process project status changes
    if (event.type === 'project_status' || event.event_type === 'project_status') {
      const status = event.data?.status || event.status;
      const projectName = event.data?.name || event.name || 'Project';

      switch (status?.toLowerCase()) {
        case 'ready':
          return {
            id,
            title: 'Project Ready',
            description: `${projectName} is ready to use`,
            variant: 'success',
            icon: <CheckCircle2 className="h-5 w-5" />,
          };
        case 'creating':
          return {
            id,
            title: 'Creating Project',
            description: `${projectName} is being created`,
            variant: 'info',
            icon: <Info className="h-5 w-5" />,
          };
        case 'error':
          return {
            id,
            title: 'Project Error',
            description: `${projectName} encountered an error`,
            variant: 'error',
            icon: <XCircle className="h-5 w-5" />,
          };
      }
    }

    // Process deployment events
    if (event.type === 'deployment_ready' || event.event_type === 'deployment_ready') {
      const name = event.data?.name || event.name || 'Deployment';
      return {
        id,
        title: 'Deployment Ready',
        description: `${name} is ready and accessible`,
        variant: 'success',
        icon: <CheckCircle2 className="h-5 w-5" />,
      };
    }

    // Process error events
    if (event.type === 'error_report' || event.event_type === 'error_report') {
      const message = event.data?.message || event.message || 'An error occurred';
      return {
        id,
        title: 'Error',
        description: message,
        variant: 'error',
        icon: <XCircle className="h-5 w-5" />,
        duration: 7000, // Show errors longer
      };
    }

    return null;
  };

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
