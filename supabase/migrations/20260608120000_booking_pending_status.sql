-- supabase/migrations/20260608120000_booking_pending_status.sql
-- Add a 'pending' booking status for member-initiated specific-time requests.
--
-- The standard hourly-slot booking flow stays auto-confirmed. When a member
-- requests an off-grid SPECIFIC time (`requestCustomBooking`), the booking is
-- created as `pending` and the trainer accepts or declines it in the portal.
-- Accepting flips it to `confirmed` (and syncs the calendar); declining flips it
-- to `cancelled_24hr_plus` with a reason.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor).
--
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older
-- Postgres. `IF NOT EXISTS` makes this safe to re-run.

alter type booking_status add value if not exists 'pending';
