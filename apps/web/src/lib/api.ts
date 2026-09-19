import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Send the signed-in staff session (default) or call the public surface. */
  auth?: boolean;
  idempotencyKey?: string;
}

async function parseError(res: Response): Promise<never> {
  let code = 'error';
  let message = `Request failed (${res.status})`;
  let details: unknown;
  try {
    const data = (await res.json()) as { error?: { code: string; message: string; details?: unknown } };
    if (data.error) {
      code = data.error.code;
      message = data.error.message;
      details = data.error.details;
    }
  } catch {
    /* keep the generic message */
  }
  throw new ApiError(res.status, code, message, details);
}

/** Server-side API client. Tokens live in httpOnly cookies and never reach the browser. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, auth = true, idempotencyKey, headers, ...rest } = options;
  const jar = await cookies();
  const accessToken = auth ? jar.get('access_token')?.value : undefined;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiUrl = API_URL;
