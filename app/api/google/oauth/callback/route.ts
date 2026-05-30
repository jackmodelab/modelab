import { NextResponse, type NextRequest } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { emailFromIdToken, exchangeCodeForTokens } from '@/lib/google/oauth';

// Google redirects here after consent. We verify the state nonce, exchange the
// code for tokens, and persist the coach's refresh token via the service-role
// client (the token must never reach the browser).
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'g_oauth_state';
const STATE_PATH = '/api/google/oauth';

export async function GET(request: NextRequest) {
  const { staff } = await requireStaff();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/portal/availability?google=${status}`, origin));
    res.cookies.set(STATE_COOKIE, '', { path: STATE_PATH, maxAge: 0 });
    return res;
  };

  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  if (params.get('error')) return back('denied');
  if (!code || !state || !cookieState || state !== cookieState) return back('error');

  try {
    const tokens = await exchangeCodeForTokens(code);

    const update: {
      google_calendar_email: string | null;
      google_calendar_connected_at: string;
      google_refresh_token?: string;
    } = {
      google_calendar_email: emailFromIdToken(tokens.id_token),
      google_calendar_connected_at: new Date().toISOString(),
    };
    // Google only returns a refresh token on (re)consent — keep the existing one
    // if this response didn't include one.
    if (tokens.refresh_token) update.google_refresh_token = tokens.refresh_token;

    const admin = createSupabaseAdmin();
    await admin.from('staff').update(update as never).eq('id', staff.id);

    return back('connected');
  } catch (err) {
    console.error('[google-calendar] OAuth callback failed:', err);
    return back('error');
  }
}
