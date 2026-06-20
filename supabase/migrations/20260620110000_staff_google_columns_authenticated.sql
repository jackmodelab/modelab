-- supabase/migrations/20260620110000_staff_google_columns_authenticated.sql
-- MODE Lab — stop signed-in MEMBERS reading a coach's Google-calendar columns
-- on `staff` (SEC-2026-06-20; completes the F-2 fix from 20260619120000).
--
-- 20260619120000_staff_anon_column_grants.sql revoked the ANON role's table-wide
-- SELECT and re-granted only the public coach-profile columns. But the
-- "public reads active staff" RLS policy (0001_initial_schema.sql) also applies
-- to the `authenticated` role, which still holds its DEFAULT table-wide SELECT.
-- RLS is ROW-level (it can't hide columns), and members + staff share the single
-- `authenticated` role — so any signed-in MEMBER could read every active coach's
-- `google_calendar_email` / `google_calendar_connected_at` directly with their
-- own JWT:  GET /rest/v1/staff?select=google_calendar_email&is_active=eq.true .
--
-- Fix with COLUMN-level privileges, the same shape as the anon grant: revoke the
-- authenticated role's table-wide SELECT and re-grant every column EXCEPT the two
-- Google ones. Those two are now read server-side via the service-role client
-- for the coach's own profile (app/portal/profile/page.tsx) and written only by
-- the service role (OAuth callback / disconnect), so no authenticated code path
-- needs them.
--
-- `auth_user_id` is deliberately KEPT readable by `authenticated`: requireStaff /
-- isStaffUser / signIn filter `staff` on it through the authenticated role, so
-- revoking it would break staff sign-in, and it is a non-exploitable opaque UUID
-- (every RLS check keys off the server-verified JWT auth.uid(), never a
-- client-supplied id).
--
-- NOTE: column grants are NOT inherited by columns added later — any new `staff`
-- column is private to authenticated by default (fail-closed) until added to the
-- GRANT below. Idempotent: REVOKE/GRANT are safe to re-run.

revoke select on public.staff from authenticated;
grant select (
  id,
  auth_user_id,
  display_name,
  title,
  bio,
  credentials,
  is_active,
  created_at,
  updated_at
) on public.staff to authenticated;
