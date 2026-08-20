export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    window.dispatchEvent(new Event("auth:unauthorized"));
  }

  return response;
}

export async function getApiError(
  response: Response,
  fallback: string,
) {
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };

    return body.error ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}
