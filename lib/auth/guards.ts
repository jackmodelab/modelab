import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { ClientRow, StaffRow } from '@/types/database';

/** The signed-in auth user, or null. */
export async function getUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Require a signed-in client. Redirects to /login if not authenticated.
 * Returns the auth user + their `clients` row.
 */
export async function requireClient() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return { user, client: client as ClientRow | null };
}

/**
 * Require a signed-in staff member. Redirects to /login if not authenticated,
 * or to /account if signed in but not staff.
 */
export async function requireStaff() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/portal');

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!staff) redirect('/account');

  return { user, staff: staff as StaffRow };
}

/** True if the signed-in user is an active staff member (no redirect). */
export async function isStaffUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}
