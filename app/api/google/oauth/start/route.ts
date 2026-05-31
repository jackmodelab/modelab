import { NextResponse, type NextRequest } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { googleAuthUrl, googleConfigured, googleRedirectUri, resolveOrigin } from '@/lib/google/oauth';

// Staff-only: kicks off the Google consent flow. Sets a short-lived anti-CSRF
// state cookie, then redirects to Google.
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'g_oauth_state';
const STATE_PATH = '/api/google/oauth';

export async function GET(request: NextRequest) {
  await requireStaff(); // redirects non-staff away

  const origin = resolveOrigin(request.nextUrl.origin);

  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/portal/availability?google=unconfigured', origin));
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(googleAuthUrl(state, googleRedirectUri(origin)));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // survives the top-level GET redirect back from Google
    path: STATE_PATH,
    maxAge: 600,
  });
  return res;
}
