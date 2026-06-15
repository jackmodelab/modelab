-- =============================================================================
-- BOOKING OVERLAP GUARD (ARC-2) — no double-booking a coach
-- =============================================================================
-- `requestBooking` checks a slot fits published availability but historically did
-- NOT check the coach was free, so two members could auto-confirm the same open
-- slot. The application now does an overlap check, and this constraint is the
-- hard backstop that holds even if a write slips past the app (staff
-- create/reschedule, a future code path, a manual SQL edit).
--
-- An EXCLUDE constraint with `&&` (range overlap) per `staff_id` forbids any two
-- OCCUPYING bookings for the same coach from overlapping in time. "Occupying" =
-- confirmed or completed; cancelled / no_show / rescheduled / pending rows are
-- excluded via the partial WHERE so they neither block nor get blocked (pending
-- off-grid requests are allowed to overlap until a coach accepts one).
--
-- `tstzrange(starts_at, ends_at)` is half-open '[)', so back-to-back sessions
-- (one ends 10:00, the next starts 10:00) do NOT count as overlapping — correct.
--
-- Requires btree_gist for the `staff_id WITH =` equality term inside the GiST
-- index. Idempotent: safe to re-run.
--
-- NOTE: adding the constraint VALIDATES existing rows immediately and cannot be
-- deferred with NOT VALID. If prod already contains overlapping confirmed
-- bookings for one coach, this will error — resolve those duplicates first, then
-- re-run. (Unlikely at single-operator launch volume.)
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor).

create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlap_per_staff'
  ) then
    alter table bookings
      add constraint bookings_no_overlap_per_staff
      exclude using gist (
        staff_id with =,
        tstzrange(starts_at, ends_at) with &&
      )
      where (status in ('confirmed', 'completed'));
  end if;
end $$;
