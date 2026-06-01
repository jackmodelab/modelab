-- Move the Google OAuth refresh token off the public-readable `staff` table.
--
-- `staff` carries a public read policy ("public reads active staff" — see
-- 0001_initial_schema.sql), and Supabase RLS is ROW-level: that policy returns
-- every column, so the anon key shipped to every browser could read each
-- coach's google_refresh_token. This table has NO anon/authenticated policy,
-- so only the service-role client (createSupabaseAdmin) can touch it.
-- Idempotent: safe to re-run / partially-applied (Supabase SQL editor aborts a
-- batch at the first error, so a duplicate run would otherwise fail on CREATE).
create table if not exists staff_google_credentials (
  staff_id      uuid primary key references staff(id) on delete cascade,
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table staff_google_credentials enable row level security;
-- Intentionally NO anon/authenticated policies → service role only.

drop trigger if exists trg_staff_google_credentials_updated_at on staff_google_credentials;
create trigger trg_staff_google_credentials_updated_at
  before update on staff_google_credentials
  for each row execute function set_updated_at();

-- Carry over any tokens already stored — only if the old column still exists,
-- so re-running after the column was dropped doesn't error.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'staff' and column_name = 'google_refresh_token'
  ) then
    insert into staff_google_credentials (staff_id, refresh_token)
    select id, google_refresh_token
    from staff
    where google_refresh_token is not null
    on conflict (staff_id) do nothing;
  end if;
end $$;

-- Remove the exposed column.
alter table staff drop column if exists google_refresh_token;
