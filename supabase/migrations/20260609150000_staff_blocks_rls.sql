-- =============================================================================
-- STAFF BLOCKS — guarantee RLS + access policy
-- =============================================================================
-- Defensive, idempotent follow-up to 20260609140000_staff_blocks.sql. The
-- `staff_blocks` table already exists in some environments (the version was
-- applied to prod before its migration body was committed), so this ensures the
-- table is locked down regardless of how it was first created: RLS on, and only
-- active staff can read/write. No-op where that's already true.
alter table if exists staff_blocks enable row level security;

drop policy if exists "staff manage blocks" on staff_blocks;
create policy "staff manage blocks" on staff_blocks for all using (is_staff());
