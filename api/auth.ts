const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// Updated to match backend UserRead schema
export interface UserRead {
  id: number;
  name: string;
  email: string;
  profile_image_url: string;
  tier_id: number | null;
}

export interface LoginData {
  email: string;
  password: string;
}

// Login uses OAuth2 form data format, not JSON
// Backend expects email in the 'username' field
export async function login(data: LoginData): Promise<TokenResponse> {
  const formData = new URLSearchParams();
  formData.append('username', data.email); // Backend uses email as username
  formData.append('password', data.password);

  const response = await fetch(`${API_URL}/api/v1/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(error.detail || 'Login failed');
  }

  return response.json();
}

// Backend UserCreate schema: name, email, password (no separate username)
export interface RegisterData {
  name: string;       // Display name (2-100 chars)
  email: string;
  password: string;   // Min 8 chars
}

// Register creates a new user
export async function register(data: RegisterData): Promise<UserRead> {
  const response = await fetch(`${API_URL}/api/v1/user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(error.detail || 'Registration failed');
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  await fetch(`${API_URL}/api/v1/logout`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Get current user info
export async function getCurrentUser(): Promise<UserRead> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const response = await fetch(`${API_URL}/api/v1/user/me/`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
}
