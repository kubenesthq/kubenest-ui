import { useAuthStore } from '@/store/auth';
import { refreshAccessToken, getCurrentUser } from '@/api/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function useAuth(requireAuth = false) {
  const router = useRouter();
  const { user, token, isAuthenticated, _hydrated, login, logout, setToken } = useAuthStore();
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!_hydrated) return;

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
  }, [requireAuth, isAuthenticated, _hydrated, router, login, setToken]);

  return {
    user,
    token,
    isAuthenticated: _hydrated && isAuthenticated,
    isLoading: !_hydrated,
    login,
    logout,
  };
}
