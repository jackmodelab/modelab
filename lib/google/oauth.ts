/**
 * Google OAuth 2.0 — dependency-free (native fetch).
 *
 * Per-coach flow: a coach grants calendar access once; we keep the long-lived
 * refresh token and mint short-lived access tokens on demand. No `googleapis`
 * dependency — keeps the Vercel bundle small and cold starts fast.
 *
 * Setup: create an OAuth 2.0 "Web application" client at
 * https://console.cloud.google.com → APIs & Services → Credentials, enable the
 * Google Calendar API, and add the redirect URI printed by `googleRedirectUri()`
 * to the client's "Authorized redirect URIs".
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// calendar.events: create/delete events. openid + email: identify the connected
// account so we can show the coach which Google address is linked.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email'];

/** Whether Google OAuth credentials are configured in the environment. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

/** The redirect URI Google calls back after consent. Must match the OAuth client config. */
export function googleRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/api/google/oauth/callback`;
}

/** Build the Google consent URL. `state` is an anti-CSRF nonce we verify on callback. */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // ask for a refresh token
    prompt: 'consent', // force refresh-token issuance even on re-consent
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  token_type: string;
};

/** Exchange an authorization code for tokens (includes the refresh token). */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Mint a fresh access token from a stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

/**
 * Decode the email claim from a Google id_token (JWT) without verifying the
 * signature — safe here because the token came straight from Google's token
 * endpoint over TLS. Returns null if absent/unparseable.
 */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const claims = JSON.parse(json) as { email?: string };
    return claims.email ?? null;
  } catch {
    return null;
  }
}
