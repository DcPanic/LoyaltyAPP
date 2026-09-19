import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * Narrow proxy for the staff stamping screen. Only the stamping endpoints are
 * reachable, and the session token stays in the httpOnly cookie on the server.
 */
const ALLOWED = new Set(['resolve', 'search', 'stamp', 'redeem', 'card', 'recent']);

function target(path: string[]): string | null {
  const [head, ...rest] = path;
  if (!head || !ALLOWED.has(head)) return null;
  return `/v1/stamping/${[head, ...rest].join('/')}`;
}

async function forward(
  method: 'GET' | 'POST',
  request: Request,
  path: string[],
): Promise<NextResponse> {
  const endpoint = target(path);
  if (!endpoint) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const query = url.search;
  const body = method === 'POST' ? await request.json().catch(() => ({})) : undefined;
  const idempotencyKey = request.headers.get('idempotency-key') ?? undefined;

  try {
    const data = await api<unknown>(`${endpoint}${query}`, { method, body, idempotencyKey });
    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ message: 'Request failed' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward('GET', request, (await params).path);
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward('POST', request, (await params).path);
}
