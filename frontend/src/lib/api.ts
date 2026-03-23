const BASE_URL = '';
const TOKEN_KEY = 'jse_token';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  url: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    ...opts,
    headers,
  });

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'message' in body
        ? (body as { message: string }).message
        : null) ??
      (body && typeof body === 'object' && 'error' in body
        ? (body as { error: string }).error
        : null) ??
      res.statusText ??
      'Request failed';

    throw new ApiError(message, res.status, body);
  }

  return body as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'GET' });
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PUT',
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' });
}
