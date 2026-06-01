-- Move the Google OAuth refresh token off the public-readable `staff` table.
--
-- `staff` carries a public read policy ("public reads active staff" — see
-- 0001_initial_schema.sql), and Supabase RLS is ROW-level: that policy returns
-- every column, so the anon key shipped to every browser could read each
-- coach's google_refresh_token. This table has NO anon/authenticated policy,
-- so only the service-role client (createSupabaseAdmin) can touch it.
create table staff_google_credentials (
  staff_id      uuid primary key references staff(id) on delete cascade,
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table staff_google_credentials enable row level security;
-- Intentionally NO anon/authenticated policies → service role only.

create trigger trg_staff_google_credentials_updated_at
  before update on staff_google_credentials
  for each row execute function set_updated_at();

-- Carry over any tokens already stored.
insert into staff_google_credentials (staff_id, refresh_token)
select id, google_refresh_token
from staff
where google_refresh_token is not null;

-- Remove the exposed column.
alter table staff drop column if exists google_refresh_token;
