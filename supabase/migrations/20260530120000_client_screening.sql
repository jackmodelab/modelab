-- supabase/migrations/20260530120000_client_screening.sql
-- MODE Lab — New Client Pre-Screening questionnaire.
--
-- One row per client capturing the mandatory pre-screening intake form
-- (MODE-LAB INTAKE-001). A client may create an account and browse the portal,
-- but is required to complete this before booking a session.
--
-- The full questionnaire response is stored in `answers` (jsonb) so the form can
-- evolve without a migration per field. Existence of a row == screening complete.

create table client_screenings (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade unique,
  answers      jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_client_screenings_client on client_screenings(client_id);

-- updated_at trigger (reuses set_updated_at() from the initial schema)
create trigger trg_client_screenings_updated_at
  before update on client_screenings
  for each row execute function set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table client_screenings enable row level security;

-- Clients can read their own screening; staff can read all.
create policy "screenings read own" on client_screenings for select
  using (client_id in (select id from clients where auth_user_id = auth.uid()) or is_staff());

-- Clients can create their own screening.
create policy "screenings insert own" on client_screenings for insert
  with check (client_id in (select id from clients where auth_user_id = auth.uid()));

-- Clients can update their own screening.
create policy "screenings update own" on client_screenings for update
  using (client_id in (select id from clients where auth_user_id = auth.uid()));

-- Staff can manage all screenings.
create policy "staff manage screenings" on client_screenings for all using (is_staff());
