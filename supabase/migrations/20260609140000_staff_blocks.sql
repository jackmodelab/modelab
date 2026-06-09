-- =============================================================================
-- STAFF BLOCKS — one-off blocked-out time on the calendar
-- =============================================================================
-- A coach can block a specific date+time range (lunch, admin, leave, etc.) so it
-- shows as unavailable on the schedule. Distinct from `staff_availability`, which
-- is the recurring weekly OPEN windows. These are one-off, dated, and CLOSED.
create table staff_blocks (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now()
);

create index idx_staff_blocks_staff on staff_blocks(staff_id, starts_at);

alter table staff_blocks enable row level security;

-- Staff manage all blocks (single trusted operator at launch — mirrors the
-- shared-bookings posture). Members never read these directly.
create policy "staff manage blocks" on staff_blocks for all using (is_staff());
