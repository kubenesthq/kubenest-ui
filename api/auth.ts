import { apiClient } from '@/lib/api-client';
import type { LoginRequest, RegisterRequest, AuthResponse } from '@/types/api';

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/login', data);
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/register', data);
}

export async function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout', {});
}
