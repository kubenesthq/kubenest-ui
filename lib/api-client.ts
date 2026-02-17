import { refreshAccessToken } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

// Use relative URL in browser (proxied through Next.js API route) to avoid CORS.
// Use absolute URL on server-side for SSR.
const API_URL = typeof window === 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  : '';

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
    credentials: 'include',
  });

  // Handle auth errors - attempt cookie-based refresh before logging out
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
    throw new Error(error.message || error.detail || `HTTP error! status: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      // Cookie-based refresh - no body needed
      const tokenResponse = await refreshAccessToken();
      localStorage.setItem('token', tokenResponse.access_token);
      useAuthStore.getState().setToken(tokenResponse.access_token);
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
