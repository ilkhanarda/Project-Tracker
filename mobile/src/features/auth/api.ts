import { apiRequest } from '@/lib/api';

import type { LoginValues, MobileAuthResponse, RegisterValues, User } from './types';

function jsonRequest(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function loginRequest(values: LoginValues) {
  return apiRequest<MobileAuthResponse>('/auth/mobile/login', jsonRequest(values));
}

export function registerRequest(values: RegisterValues) {
  return apiRequest<MobileAuthResponse>('/auth/mobile/register', jsonRequest(values));
}

export function getCurrentUserRequest() {
  return apiRequest<{ user: User }>('/auth/me');
}

export function logoutRequest() {
  return apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
}
