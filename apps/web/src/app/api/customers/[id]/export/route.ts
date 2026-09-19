import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** GDPR access request: the full record the platform holds for one customer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const upstream = await fetch(`${API_URL}/v1/customers/${id}/export`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!upstream.ok) return new Response('Export failed', { status: upstream.status });

  return new Response(await upstream.text(), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="customer-${id}.json"`,
    },
  });
}
