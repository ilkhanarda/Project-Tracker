import { Platform } from 'react-native';

import { sessionStorage } from './session-storage';

const fallbackApiUrl =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://127.0.0.1:3000';

const environmentApiUrl =
  Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_WEB_API_URL
    : process.env.EXPO_PUBLIC_API_URL;

export const API_URL = environmentApiUrl ?? fallbackApiUrl;

type HealthResponse = {
  status: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await sessionStorage.get();
  const headers = new Headers(init.headers);

  headers.set('Accept', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    let message = 'Request failed';

    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // Keep the generic message when the response body is not JSON.
    }

    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error(`Backend ${response.status} cevabını gönderdi.`);
  }

  return response.json() as Promise<HealthResponse>;
}
