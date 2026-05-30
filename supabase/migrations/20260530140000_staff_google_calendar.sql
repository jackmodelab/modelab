-- supabase/migrations/20260530140000_staff_google_calendar.sql
-- MODE Lab — Google Calendar integration (per-coach OAuth).
--
-- Each coach connects their own Google account once (OAuth consent). We persist
-- the long-lived refresh token so the server can mint access tokens and write
-- booking events directly into that coach's calendar. Access tokens are short-
-- lived and never stored — they're refreshed on demand.
--
-- SECURITY: google_refresh_token is sensitive. It is only ever read server-side
-- via the service-role client (createSupabaseAdmin) — never selected into client
-- components. The existing "staff manage staff" RLS policy still applies for the
-- authenticated path, but token reads/writes for sync go through service role.

alter table staff
  add column if not exists google_refresh_token       text,
  add column if not exists google_calendar_email       text,
  add column if not exists google_calendar_connected_at timestamptz;

comment on column staff.google_refresh_token is
  'Google OAuth refresh token for Calendar API. Server-side use only (service role).';
comment on column staff.google_calendar_email is
  'The Google account email a coach connected, shown in the portal.';
comment on column staff.google_calendar_connected_at is
  'When the coach last connected/refreshed their Google Calendar authorisation.';
