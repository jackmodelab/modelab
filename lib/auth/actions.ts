'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';

export type AuthState = { error?: string } | undefined;

function readCredentials(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  return { email, password };
}

/** Email + password sign-in. On success, redirects staff to /portal, clients to /account. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const next = String(formData.get('next') ?? '');

  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // Decide destination: explicit ?next wins, else route by role.
  let destination = next && next.startsWith('/') ? next : '';
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
  redirect(destination);
}

/** Email + password sign-up. A `clients` row is created by the handle_new_user trigger. */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email || !password) return { error: 'Enter your email and password.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const supabase = createSupabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/account');
}

export async function signOut() {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
