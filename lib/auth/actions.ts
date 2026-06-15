'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export type AuthState = { error?: string; success?: string } | undefined;

const PASSWORD_MIN = 8;
const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';

function readCredentials(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  return { email, password };
}

/** Best-effort per-IP throttle for an auth action. Returns true if blocked. */
async function authThrottled(scope: string, limit: number, windowMs: number): Promise<boolean> {
  const ip = clientIp(await headers());
  return !rateLimit(`${scope}:${ip}`, limit, windowMs).ok;
}

/** Email + password sign-in. On success, redirects staff to /portal, clients to /account. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const next = String(formData.get('next') ?? '');

  if (!email || !password) return { error: 'Enter your email and password.' };
  // Throttle credential stuffing — 10 attempts / 5 min per IP (Supabase also throttles).
  if (await authThrottled('login', 10, 5 * 60 * 1000)) return { error: TOO_MANY };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // Single generic message — never reveal whether it was the email or the
  // password that was wrong (user-enumeration defence, SEC-4).
  if (error) return { error: 'Invalid email or password.' };

  // Decide destination: explicit ?next wins, else route by role.
  // Reject protocol-relative (`//evil.com`) and backslash (`/\evil.com`) values that
  // browsers treat as off-site — an open-redirect/phishing vector after login.
  const safeNext = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
  let destination = safeNext ? next : '';
  if (!destination) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('auth_user_id', data.user.id)
      .eq('is_active', true)
      .maybeSingle();
    destination = staff ? '/portal' : '/account';
  }

  revalidatePath('/', 'layout');
  // Signal the splash screen to play once on the destination page (it only
  // shows after a successful sign-in, not when navigating to the login page).
  redirect(withWelcome(destination));
}

/** Append the splash-screen `welcome` flag, preserving any existing query string. */
function withWelcome(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}welcome=1`;
}

/** Email + password sign-up. A `clients` row is created by the handle_new_user trigger. */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email || !password) return { error: 'Enter your email and password.' };
  if (password.length < PASSWORD_MIN) return { error: `Password must be at least ${PASSWORD_MIN} characters.` };
  // Throttle account-creation abuse — 5 signups / hour per IP.
  if (await authThrottled('signup', 5, 60 * 60 * 1000)) return { error: TOO_MANY };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  // If Supabase requires email confirmation, signUp returns no session. Don't
  // bounce to /account (the middleware would punt the session-less user back to
  // /login — a confusing dead-end). Show a "check your email" state instead.
  // When confirmation is disabled, a session is present and we proceed.
  if (!data.session) {
    return {
      success: 'Account created. Check your email for a confirmation link, then sign in.',
    };
  }

  revalidatePath('/', 'layout');
  redirect(withWelcome('/account'));
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * Step 1 of password recovery: email a reset link. The link returns to
 * /auth/callback (which exchanges the recovery code for a session) and lands on
 * /reset-password. We always report success — never reveal whether an account
 * exists for the address (account-enumeration defence).
 */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Enter your email.' };
  // Throttle reset-email abuse — 5 requests / hour per IP.
  if (await authThrottled('pwreset', 5, 60 * 60 * 1000)) return { error: TOO_MANY };

  const supabase = await createSupabaseServer();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  return { success: 'If an account exists for that email, a reset link is on its way. Check your inbox.' };
}

/**
 * Step 2 of password recovery: set the new password. Requires the recovery
 * session established by the callback — if the link expired or was already used,
 * updateUser fails and we surface a friendly error so the user can re-request.
 */
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < PASSWORD_MIN) return { error: `Password must be at least ${PASSWORD_MIN} characters.` };
  if (password !== confirm) return { error: 'Those passwords don’t match.' };

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'This reset link has expired or already been used. Request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/account');
}
