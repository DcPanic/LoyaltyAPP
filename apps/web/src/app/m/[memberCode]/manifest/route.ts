import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

interface MemberResponse {
  business: { name: string; primaryColor: string; secondaryColor: string };
  program: { rewardName: string; stampsRequired: number };
}

/**
 * A per-café web app manifest, so a customer can keep their card on the home
 * screen. It opens straight to their own card and looks like an app icon, which
 * is the fallback when a café has no wallet credentials yet — and a useful
 * extra even when it has.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberCode: string }> },
): Promise<NextResponse> {
  const { memberCode } = await params;

  try {
    const member = await api<MemberResponse>(`/v1/public/member/${memberCode}`, { auth: false });
    return NextResponse.json(
      {
        name: `${member.business.name} loyalty card`,
        short_name: member.business.name.slice(0, 12),
        description: `Collect ${member.program.stampsRequired} stamps and get ${member.program.rewardName}.`,
        start_url: `/m/${memberCode}`,
        scope: `/m/${memberCode}`,
        display: 'standalone',
        orientation: 'portrait',
        background_color: member.business.secondaryColor,
        theme_color: member.business.primaryColor,
        icons: [
          {
            src: `/m/${memberCode}/icon`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      { headers: { 'content-type': 'application/manifest+json' } },
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ error: 'not_found' }, { status });
  }
}
