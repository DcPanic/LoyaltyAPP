import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const FALLBACK = 'http://localhost:4000';

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  FALLBACK;

const ACCESS_KEY = 'loyaltyapp.access';
const REFRESH_KEY = 'loyaltyapp.refresh';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export const getAccessToken = () => SecureStore.getItemAsync(ACCESS_KEY);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH_KEY);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string;
  /** Internal: prevents an endless refresh loop. */
  retried?: boolean;
}

async function raw<T>(path: string, options: RequestOptions): Promise<T> {
  const token = options.auth === false ? null : await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : {};
  if (!res.ok) {
    const error = (data as { error?: { code: string; message: string } }).error;
    throw new ApiError(res.status, error?.code ?? 'error', error?.message ?? 'Request failed');
  }
  return data as T;
}

/** API client with a single transparent token refresh on 401. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await raw<T>(path, options);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || options.retried) throw err;

    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw err;

    const refreshed = await raw<{ accessToken: string; refreshToken: string }>('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }).catch(() => null);

    if (!refreshed) {
      await clearTokens();
      throw err;
    }
    await saveTokens(refreshed.accessToken, refreshed.refreshToken);
    return raw<T>(path, { ...options, retried: true });
  }
}

export const newIdempotencyKey = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
