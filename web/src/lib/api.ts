import type { AuthTokens } from "../types/auth";

export type ApiError = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";
let accessToken: string | null = null;
let refreshPromise: Promise<AuthTokens | null> | null = null;
let onLogout: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setLogoutHandler = (handler: () => void) => {
  onLogout = handler;
};

const refresh = (): Promise<AuthTokens | null> => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "fetch" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const result = (await response.json()) as AuthTokens;
        accessToken = result.accessToken;
        return result;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const requestOnce = async (
  path: string,
  options: RequestInit = {},
): Promise<Response> => {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
};

export const apiRequest = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  let response = await requestOnce(path, options);
  if (response.status === 401) {
    const result = await refresh();
    if (!result) {
      accessToken = null;
      onLogout?.();
      throw new Error("Session expired");
    }
    response = await requestOnce(path, options);
    if (response.status === 401) {
      accessToken = null;
      onLogout?.();
      throw new Error("Session expired");
    }
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error.message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export const restoreSession = async (): Promise<AuthTokens | null> => refresh();

export const logout = async (): Promise<void> => {
  try {
    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "fetch" },
    });
  } finally {
    accessToken = null;
  }
};
