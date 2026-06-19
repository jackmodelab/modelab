-- supabase/migrations/20260619120000_staff_anon_column_grants.sql
-- MODE Lab — stop the anon key from reading sensitive `staff` columns (F-2 / T-2).
--
-- RLS is ROW-level, so the "public reads active staff" policy
-- (0001_initial_schema.sql) hands the anon key EVERY column of an active staff
-- row — including `auth_user_id` and the Google-calendar columns. The pen-test
-- (SECURITY_REVIEW_2026-06-19.md) confirmed an anon caller could read
-- `auth_user_id`; `google_calendar_email` would leak the moment a coach links
-- Google Calendar.
--
-- Fix with COLUMN-level privileges: revoke the anon role's table-wide SELECT and
-- re-grant it ONLY the public coach-profile columns. RLS is untouched, and no
-- app code path is affected — every `staff` read in the app runs as the
-- authenticated role (portal staff, logged-in members) or the service role
-- (createSupabaseAdmin); the public marketing pages are static /public/*.html
-- and never query Supabase. After this, `GET /rest/v1/staff?select=auth_user_id`
-- with the anon key is denied, while id/display_name/title/bio/credentials/
-- is_active stay publicly readable.
--
-- NOTE: column grants are NOT inherited by columns added later, so any new
-- `staff` column is private to anon by default (fail-closed) until it is
-- explicitly added to the GRANT below.
-- Idempotent: REVOKE/GRANT are safe to re-run (Supabase SQL editor aborts a
-- batch on the first error, so this stays single-statement-safe).

revoke select on public.staff from anon;
grant select (id, display_name, title, bio, credentials, is_active) on public.staff to anon;
