'use client';

import { type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';
import { useSSE } from '@/hooks/useSSE';
import { EventToast } from '@/components/notifications/EventToast';

interface SSEProviderProps {
  children: ReactNode;
}

/**
 * SSEProvider component establishes and manages SSE connection
 * - Automatically connects when user is authenticated
 * - Disconnects on logout
 * - Renders EventToast for global notifications
 * - Stores all events in useSSE hook
 */
export function SSEProvider({ children }: SSEProviderProps) {
  const { isAuthenticated } = useAuthStore();

  const { connected, error, reconnecting } = useSSE(
    undefined,
    isAuthenticated
  );

  return (
    <>
      {children}
      {isAuthenticated && <EventToast />}
    </>
  );
}
