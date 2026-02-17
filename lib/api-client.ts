import { refreshAccessToken } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RequestOptions extends RequestInit {
  token?: string;
  _retried?: boolean;
}

async function fetchWithAuth(url: string, options: RequestOptions = {}): Promise<any> {
  const token = options.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  const response = await fetch(`${API_URL}/api/v1${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Handle auth errors - attempt refresh before logging out
  if (response.status === 401 && !options._retried) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return fetchWithAuth(url, { ...options, _retried: true });
    }

    if (typeof window !== 'undefined') {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const storedRefreshToken = localStorage.getItem('refreshToken');
  if (!storedRefreshToken) return false;

  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const tokenResponse = await refreshAccessToken(storedRefreshToken);
      localStorage.setItem('token', tokenResponse.access_token);
      if (tokenResponse.refresh_token) {
        localStorage.setItem('refreshToken', tokenResponse.refresh_token);
        useAuthStore.getState().login(
          tokenResponse.access_token,
          useAuthStore.getState().user!,
          tokenResponse.refresh_token
        );
      } else {
        useAuthStore.getState().setToken(tokenResponse.access_token);
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const apiClient = {
  get: <T>(url: string, options?: RequestOptions): Promise<T> =>
    fetchWithAuth(url, { ...options, method: 'GET' }),

  post: <T>(url: string, data: unknown, options?: RequestOptions): Promise<T> =>
    fetchWithAuth(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }),

  patch: <T>(url: string, data: unknown, options?: RequestOptions): Promise<T> =>
    fetchWithAuth(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  delete: <T>(url: string, options?: RequestOptions): Promise<T> =>
    fetchWithAuth(url, { ...options, method: 'DELETE' }),
};
