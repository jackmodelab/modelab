import { headers } from 'next/headers';

/**
 * Absolute origin (scheme + host, no trailing slash) for building auth-email
 * redirect links: password reset, set-password invites, signup confirmation.
 *
 * Prefers NEXT_PUBLIC_SITE_URL (the canonical domain). If that's unset OR an
 * empty string — a prod misconfig we actually hit: the var existed in Vercel
 * but was "", so every `${SITE}/auth/callback` collapsed to a bare path,
 * Supabase fell back to its dashboard Site URL (localhost), and clients'
 * reset/invite emails opened localhost — fall back to the incoming request's
 * forwarded host so links stay on whatever domain the user is actually on.
 *
 * Safe against Host spoofing: Supabase only honours a redirectTo that matches
 * its Redirect-URLs allow-list, otherwise it ignores it. So the worst a forged
 * Host can do is get ignored, not redirect a user somewhere unlisted.
 */
export async function siteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (env) return env;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (host) {
    const proto = h.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  return '';
}
