import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { ClientRow, StaffRow } from '@/types/database';

/** The signed-in auth user, or null. Memoized per request. */
export const getUser = cache(async () => {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Require a signed-in client. Redirects to /login if not authenticated.
 * Returns the auth user + their `clients` row. Memoized per request.
 */
export const requireClient = cache(async () => {
  const supabase = await createSupabaseServer();
  const user = await getUser();
  if (!user) redirect('/login?next=/account');

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return { user, client: client as ClientRow | null };
});

/**
 * Require a signed-in staff member. Redirects to /login if not authenticated,
 * or to /account if signed in but not staff. Memoized per request.
 */
export const requireStaff = cache(async () => {
  const supabase = await createSupabaseServer();
  const user = await getUser();
  if (!user) redirect('/login?next=/portal');

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!staff) redirect('/account');

  return { user, staff: staff as StaffRow };
});

/** True if the signed-in user is an active staff member (no redirect). Memoized per request. */
export const isStaffUser = cache(async () => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
});
