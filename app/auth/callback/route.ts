import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

/**
 * Handles the email-confirmation / magic-link redirect.
 * Exchanges the `code` for a session, then sends the user to /account.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Reject off-site redirect targets (`//evil.com`, `/\evil.com`) — open-redirect defence.
  const raw = searchParams.get('next') ?? '/account';
  const next = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/account';

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Play the splash on real login landings, but not the password-recovery
      // flow (which routes through /reset-password before the user is "in").
      const isRecovery = next.startsWith('/reset-password');
      const dest = isRecovery ? next : `${next}${next.includes('?') ? '&' : '?'}welcome=1`;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
