import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** Streams the CSV export through the server so the token stays in the cookie. */
export async function GET(): Promise<Response> {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const upstream = await fetch(`${API_URL}/v1/customers/export/csv`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!upstream.ok) return new Response('Export failed', { status: upstream.status });

  return new Response(await upstream.text(), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="customers.csv"',
    },
  });
}
