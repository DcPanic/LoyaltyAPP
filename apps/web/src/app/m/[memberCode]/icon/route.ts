import { api, ApiError } from '@/lib/api';

interface MemberResponse {
  business: { name: string; primaryColor: string };
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Home-screen icon: the café's colour and initial, drawn as SVG. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberCode: string }> },
): Promise<Response> {
  const { memberCode } = await params;

  try {
    const member = await api<MemberResponse>(`/v1/public/member/${memberCode}`, { auth: false });
    const initial = escape(member.business.name.charAt(0).toUpperCase());
    const color = /^#[0-9a-fA-F]{6}$/.test(member.business.primaryColor)
      ? member.business.primaryColor
      : '#6F4E37';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${color}"/>
  <text x="256" y="256" fill="#ffffff" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="260" font-weight="700" text-anchor="middle" dominant-baseline="central">${initial}</text>
</svg>`;

    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml',
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response('Not found', { status: err instanceof ApiError ? err.status : 500 });
  }
}
