import { useAuthStore } from '@/store/auth';
import { refreshAccessToken, getCurrentUser } from '@/api/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';

function useHydrated() {
  return useSyncExternalStore(
    (cb) => useAuthStore.persist.onFinishHydration(cb),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}

export function useAuth(requireAuth = false) {
  const router = useRouter();
  const { user, token, isAuthenticated, login, logout, setToken } = useAuthStore();
  const hydrated = useHydrated();
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!hydrated) return;

    if (requireAuth && !isAuthenticated && !refreshAttempted.current) {
      refreshAttempted.current = true;
      // Try refreshing the token from the httpOnly cookie
      refreshAccessToken()
        .then(async (data) => {
          setToken(data.access_token);
          try {
            const me = await getCurrentUser();
            login(data.access_token, { id: String(me.id), email: me.email, name: me.name });
          } catch {
            // Token works but user fetch failed — still set authenticated
            useAuthStore.setState({ isAuthenticated: true });
          }
        })
        .catch(() => {
          router.push('/login');
        });
    } else if (requireAuth && !isAuthenticated) {
      router.push('/login');
    }
  }, [requireAuth, isAuthenticated, hydrated, router, login, setToken]);

  return {
    user,
    token,
    isAuthenticated: hydrated && isAuthenticated,
    isLoading: !hydrated,
    login,
    logout,
  };
}
