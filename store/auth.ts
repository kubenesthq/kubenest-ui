import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  is_superadmin?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  activeOrgId: string | null;
  isSuperadmin: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setActiveOrgId: (orgId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      activeOrgId: null,
      isSuperadmin: false,
      login: (token, user) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
        }
        set({ token, user, isAuthenticated: true, isSuperadmin: !!user.is_superadmin });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        set({ token: null, user: null, isAuthenticated: false, activeOrgId: null, isSuperadmin: false });
      },
      setUser: (user) => set({ user, isSuperadmin: !!user.is_superadmin }),
      setToken: (token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
        }
        set({ token });
      },
      setActiveOrgId: (orgId) => set({ activeOrgId: orgId }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
