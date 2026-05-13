import { refreshAccessToken } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

// Use relative URL in browser (proxied through Next.js API route) to avoid CORS.
// Use absolute URL on server-side for SSR.
const API_URL = typeof window === 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  : '';

export class ApiClientError extends Error {
  status: number;
  code?: string;
  detail?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      detail?: unknown;
    },
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.detail = options.detail;
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
  _retried?: boolean;
}

async function fetchWithAuth<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
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
      return fetchWithAuth<T>(url, { ...options, _retried: true });
    }

    if (typeof window !== 'undefined') {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({ message: `HTTP error! status: ${response.status}` }));

    let message = `HTTP error! status: ${response.status}`;
    let code: string | undefined;
    let detail: unknown = payload;

    if (payload && typeof payload === 'object') {
      const objectPayload = payload as Record<string, unknown>;
      const topLevelMessage = objectPayload.message;
      const topLevelDetail = objectPayload.detail;

      if (typeof topLevelMessage === 'string' && topLevelMessage.trim().length > 0) {
        message = topLevelMessage;
      } else if (typeof topLevelDetail === 'string' && topLevelDetail.trim().length > 0) {
        message = topLevelDetail;
      } else if (topLevelDetail && typeof topLevelDetail === 'object') {
        const detailObject = topLevelDetail as Record<string, unknown>;
        if (typeof detailObject.message === 'string' && detailObject.message.trim().length > 0) {
          message = detailObject.message;
        }
        if (typeof detailObject.code === 'string') {
          code = detailObject.code;
        }
        detail = detailObject;
      } else if (typeof objectPayload.error === 'string' && objectPayload.error.trim().length > 0) {
        message = objectPayload.error;
      }
    }

    throw new ApiClientError(message, {
      status: response.status,
      code,
      detail,
    });
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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
    fetchWithAuth<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, data: unknown, options?: RequestOptions): Promise<T> =>
    fetchWithAuth<T>(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }),

  patch: <T>(url: string, data: unknown, options?: RequestOptions): Promise<T> =>
    fetchWithAuth<T>(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  put: <T>(url: string, data: unknown, options?: RequestOptions): Promise<T> =>
    fetchWithAuth<T>(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  delete: <T>(url: string, options?: RequestOptions): Promise<T> =>
    fetchWithAuth<T>(url, { ...options, method: 'DELETE' }),
};
