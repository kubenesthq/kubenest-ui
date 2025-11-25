'use client';

import { useEffect, type ReactNode } from 'react';
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
  const { isAuthenticated, token } = useAuthStore();

  // Use the existing useSSE hook with optional filters
  // Pass undefined for filters to subscribe to all events
  const { connected, error, reconnecting } = useSSE(
    undefined, // No filters - subscribe to all events
    isAuthenticated // Only connect when authenticated
  );

  // Log connection status changes
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[SSEProvider] SSE connection status:', {
        connected,
        error,
        reconnecting,
      });
    }
  }, [connected, error, reconnecting, isAuthenticated]);

  return (
    <>
      {children}
      {isAuthenticated && <EventToast />}
    </>
  );
}
