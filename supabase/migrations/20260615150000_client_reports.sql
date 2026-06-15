-- supabase/migrations/20260615150000_client_reports.sql
-- MODE Lab — Client Reports (staff-authored progress / quarterly / results write-ups).
--
-- Lets staff build a structured report for a client in the portal instead of
-- writing it up in a separate doc. A report can be displayed in-site, printed,
-- or saved to PDF (browser print), and optionally shared into the member portal.
--
-- The body is stored in `content` (jsonb) so the section/metric structure can
-- evolve without a migration per field — same pattern as `client_screenings`.
-- Top-level columns (type/title/period/status) stay relational so reports can be
-- listed, filtered and sorted cheaply.
--
-- Visibility: staff manage everything; a member only ever sees a report once it
-- is BOTH published AND explicitly shared (`shared_with_client`). New reports
-- start as private drafts, so nothing leaks while it's being written.

-- =============================================================================
-- ENUMS
-- =============================================================================
create type report_type   as enum ('progress', 'quarterly', 'results', 'general');
create type report_status as enum ('draft', 'published');

-- =============================================================================
-- CLIENT REPORTS
-- =============================================================================
create table client_reports (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients(id) on delete cascade,
  author_staff_id    uuid references staff(id) on delete set null,
  type               report_type   not null default 'progress',
  title              text not null,
  period_start       date,
  period_end         date,
  summary            text,
  content            jsonb         not null default '{}'::jsonb,
  status             report_status not null default 'draft',
  shared_with_client boolean       not null default false,
  published_at       timestamptz,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);
create index idx_client_reports_client on client_reports(client_id, created_at desc);
create index idx_client_reports_status on client_reports(status, shared_with_client);

-- updated_at trigger (reuses set_updated_at() from the initial schema)
create trigger trg_client_reports_updated_at
  before update on client_reports
  for each row execute function set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table client_reports enable row level security;

-- Staff can do anything (author, edit, publish, delete).
create policy "staff manage client_reports" on client_reports for all using (is_staff());

-- A member can read ONLY their own reports that have been published AND shared.
-- Drafts and unshared reports are invisible to the client.
create policy "clients read own shared reports" on client_reports for select
  using (
    client_id in (select id from clients where auth_user_id = auth.uid())
    and status = 'published'
    and shared_with_client = true
  );
