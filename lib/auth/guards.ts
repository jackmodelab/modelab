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
 * Require a signed-in client whose account is ACTIVE (not archived). Use this in
 * every member-initiated MUTATION (booking, cancel, profile edit, screening,
 * file access). Archiving is meant to revoke portal access, but the account
 * layout only enforces that when rendering pages — server actions are reachable
 * directly (a replayed POST), so each one must re-check. Without this, an
 * archived member could keep booking sessions, editing their profile, or minting
 * signed URLs for their files by calling the actions straight from the browser
 * console. Redirects archived / identity-less callers to /account, where the
 * layout shows the "inactive" notice. Memoized per request.
 */
export const requireActiveClient = cache(async () => {
  const { user, client } = await requireClient();
  if (!client || client.archived_at) redirect('/account');
  return { user, client };
});

/**
 * Require a signed-in staff member. Redirects to /login if not authenticated,
 * or to /account if signed in but not staff. Memoized per request.
 */
export const requireStaff = cache(async () => {
  const supabase = await createSupabaseServer();
  const user = await getUser();
  if (!user) redirect('/login?next=/portal');

  // Explicit column list (NOT select('*')): the authenticated role's table-wide
  // SELECT on `staff` was revoked in 20260620110000, re-granting only these
  // non-Google columns. PostgREST expands `*` to every column regardless of
  // per-role column privileges, so a `select('*')` here would include the
  // revoked google_calendar_* columns and fail the whole query (→ staff locked
  // out of /portal). The two Google columns are read separately via the
  // service-role client (app/portal/profile/page.tsx); nothing here needs them.
  const { data: staff } = await supabase
    .from('staff')
    .select(
      'id, auth_user_id, display_name, title, bio, credentials, is_active, created_at, updated_at',
    )
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
