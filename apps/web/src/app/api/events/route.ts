import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Proxies the API's tenant-scoped SSE stream so the browser never holds a token.
 * This is what makes a stamp taken on the mobile app appear on the web dashboard.
 */
export async function GET(): Promise<Response> {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const upstream = await fetch(`${API_URL}/v1/events/stream`, {
    headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
    cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body) {
    return new Response('Stream unavailable', { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
