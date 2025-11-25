import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAuth(requireAuth = false) {
  const router = useRouter();
  const { user, token, isAuthenticated, login, logout } = useAuthStore();

  useEffect(() => {
    if (requireAuth && !isAuthenticated) {
      router.push('/login');
    }
  }, [requireAuth, isAuthenticated, router]);

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout,
  };
}
