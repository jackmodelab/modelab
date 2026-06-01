import { NextResponse, type NextRequest } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { emailFromIdToken, exchangeCodeForTokens, googleRedirectUri, resolveOrigin } from '@/lib/google/oauth';

// Google redirects here after consent. We verify the state nonce, exchange the
// code for tokens, and persist the coach's refresh token via the service-role
// client (the token must never reach the browser).
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'g_oauth_state';
const STATE_PATH = '/api/google/oauth';

export async function GET(request: NextRequest) {
  const { staff } = await requireStaff();
  const origin = resolveOrigin(request.nextUrl.origin);

  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/portal/profile?google=${status}`, origin));
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
    // redirect_uri must exactly match the one used in the consent request.
    const tokens = await exchangeCodeForTokens(code, googleRedirectUri(origin));

    const update: {
      google_calendar_email: string | null;
      google_calendar_connected_at: string;
    } = {
      google_calendar_email: emailFromIdToken(tokens.id_token),
      google_calendar_connected_at: new Date().toISOString(),
    };

    const admin = createSupabaseAdmin();
    await admin.from('staff').update(update as never).eq('id', staff.id);

    // The refresh token lives in the service-role-only staff_google_credentials
    // table (never the public-readable staff table). Google only returns a
    // refresh token on (re)consent — only upsert when this response had one.
    if (tokens.refresh_token) {
      await admin
        .from('staff_google_credentials')
        .upsert(
          { staff_id: staff.id, refresh_token: tokens.refresh_token },
          { onConflict: 'staff_id' }
        );
    }

    return back('connected');
  } catch (err) {
    console.error('[google-calendar] OAuth callback failed:', err);
    return back('error');
  }
}
