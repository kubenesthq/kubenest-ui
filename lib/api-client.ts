const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RequestOptions extends RequestInit {
  token?: string;
}

async function fetchWithAuth(url: string, options: RequestOptions = {}) {
  const token = options.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  const response = await fetch(`${API_URL}/api/v1${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Handle auth errors
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
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
