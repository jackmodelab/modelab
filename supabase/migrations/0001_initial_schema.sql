-- supabase/migrations/0001_initial_schema.sql
-- MODE Lab — initial schema (Supabase-only: Auth + Postgres + Storage + Stripe).
-- Apply with:  supabase db push   (after `supabase link`)
-- or paste into the Supabase SQL editor.

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
-- gen_random_uuid() is built into Postgres 13+ (Supabase), no extension needed.
create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================
create type location_status as enum ('active', 'coming_soon', 'closed');
create type booking_status as enum (
  'confirmed', 'completed',
  'cancelled_24hr_plus', 'cancelled_under_24hr',
  'no_show', 'rescheduled'
);
create type package_status as enum ('active', 'expired', 'consumed', 'refunded', 'cancelled');
create type discount_tier as enum ('standard', 'student_senior', 'friends_family');
create type assessment_type as enum ('body_comp', 'movement_screen', 'custom');

-- =============================================================================
-- LOCATIONS
-- =============================================================================
create table locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text,
  suburb text,
  postcode text,
  state text,
  lat numeric(10,7),
  lng numeric(10,7),
  status location_status not null default 'active',
  opens_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_locations_status on locations(status);

-- =============================================================================
-- STAFF
-- =============================================================================
create table staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null unique,
  display_name text not null,
  title text,
  bio text,
  credentials jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- SERVICES
-- =============================================================================
create table services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  duration_minutes integer not null,
  base_price_cents integer not null,
  stripe_price_id text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_services_active_sort on services(is_active, sort_order);

-- =============================================================================
-- PACKAGES
-- =============================================================================
create table packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_cents integer not null,
  stripe_price_id text,
  stripe_product_id text,
  is_recurring boolean not null default false,
  validity_days integer,
  tagline text,
  includes jsonb not null default '[]'::jsonb,
  session_allocations jsonb not null default '{}'::jsonb,
  is_hero_offer boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_packages_active_sort on packages(is_active, sort_order);

-- =============================================================================
-- CLIENTS
-- =============================================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade unique,
  email text not null unique,
  full_name text,
  phone text,
  date_of_birth date,
  emergency_contact jsonb,
  health_notes text,
  stripe_customer_id text unique,
  discount_tier discount_tier not null default 'standard',
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_clients_email on clients(email);

-- =============================================================================
-- CLIENT PACKAGES (what each client owns)
-- =============================================================================
create table client_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  package_id uuid not null references packages(id),
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  sessions_remaining jsonb not null default '{}'::jsonb,
  status package_status not null default 'active',
  auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_packages_client on client_packages(client_id);
create index idx_client_packages_status on client_packages(status);

-- =============================================================================
-- BOOKINGS
-- =============================================================================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  staff_id uuid not null references staff(id),
  location_id uuid not null references locations(id),
  service_id uuid not null references services(id),
  client_package_id uuid references client_packages(id),
  google_calendar_event_id text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status booking_status not null default 'confirmed',
  cancellation_reason text,
  rescheduled_to_booking_id uuid references bookings(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bookings_client on bookings(client_id);
create index idx_bookings_staff_starts on bookings(staff_id, starts_at);
create index idx_bookings_starts_at on bookings(starts_at);

-- =============================================================================
-- ASSESSMENTS (body comp scans, movement screens, reports)
-- =============================================================================
create table assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  assessment_date date not null,
  type assessment_type not null,
  data jsonb not null default '{}'::jsonb,
  notes text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assessments_client_date on assessments(client_id, assessment_date desc);

-- =============================================================================
-- DOCUMENTS (files the trainer shares with a client; stored in Storage)
-- =============================================================================
create table documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  uploaded_by_staff_id uuid references staff(id) on delete set null,
  title text not null,
  description text,
  storage_path text not null,
  file_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_documents_client on documents(client_id, created_at desc);

-- =============================================================================
-- ARTICLES (research page, members-only content)
-- =============================================================================
create table articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text,
  category text,
  members_only boolean not null default true,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_articles_published on articles(published, published_at desc);

-- =============================================================================
-- STAFF AVAILABILITY (weekly recurring; drives booking slots)
-- =============================================================================
create table staff_availability (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  weekday smallint not null check (weekday between 0 and 6), -- 0=Sun
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_availability_staff on staff_availability(staff_id, weekday);

-- =============================================================================
-- CLIENT ASSIGNMENTS (which staff "owns" a client)
-- =============================================================================
create table client_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unique (client_id, staff_id)
);
create index idx_assignments_staff on client_assignments(staff_id) where is_active;

-- =============================================================================
-- LEADS (contact-form enquiries)
-- =============================================================================
create table leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  phone text,
  source text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_leads_source_created on leads(source, created_at desc);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ declare t text;
begin
  for t in select unnest(array[
    'locations','staff','services','packages','clients',
    'client_packages','bookings','assessments','documents','articles'
  ]) loop
    execute format('create trigger trg_%I_updated_at before update on %I for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- =============================================================================
-- handle_new_user: create a clients row whenever someone signs up
-- =============================================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.clients (auth_user_id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table locations           enable row level security;
alter table staff               enable row level security;
alter table services            enable row level security;
alter table packages            enable row level security;
alter table clients             enable row level security;
alter table client_packages     enable row level security;
alter table bookings            enable row level security;
alter table assessments         enable row level security;
alter table documents           enable row level security;
alter table articles            enable row level security;
alter table staff_availability  enable row level security;
alter table client_assignments  enable row level security;
alter table leads               enable row level security;

-- is_staff(): is the current user an active staff member?
create or replace function is_staff() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from staff where auth_user_id = auth.uid() and is_active = true);
$$;

-- Public catalog reads
create policy "public reads locations"     on locations for select using (true);
create policy "public reads active staff"  on staff     for select using (is_active = true);
create policy "public reads services"      on services  for select using (is_active = true);
create policy "public reads packages"      on packages  for select using (is_active = true);
create policy "public reads availability"  on staff_availability for select using (is_active = true);

-- Staff can manage catalog
create policy "staff manage locations"     on locations          for all using (is_staff());
create policy "staff manage staff"         on staff              for all using (is_staff());
create policy "staff manage services"      on services           for all using (is_staff());
create policy "staff manage packages"      on packages           for all using (is_staff());
create policy "staff manage availability"  on staff_availability for all using (is_staff());

-- Clients: own row; staff see all
create policy "clients read self"   on clients for select using (auth.uid() = auth_user_id or is_staff());
create policy "clients update self" on clients for update using (auth.uid() = auth_user_id);
create policy "staff manage clients" on clients for all using (is_staff());

-- Client packages: own; staff all
create policy "client_packages read own" on client_packages for select
  using (client_id in (select id from clients where auth_user_id = auth.uid()) or is_staff());
create policy "staff manage client_packages" on client_packages for all using (is_staff());

-- Bookings: own; staff all
create policy "bookings read own" on bookings for select
  using (client_id in (select id from clients where auth_user_id = auth.uid()) or is_staff());
create policy "bookings update own" on bookings for update
  using (client_id in (select id from clients where auth_user_id = auth.uid()));
create policy "staff manage bookings" on bookings for all using (is_staff());

-- Assessments: own read; staff all
create policy "assessments read own" on assessments for select
  using (client_id in (select id from clients where auth_user_id = auth.uid()) or is_staff());
create policy "staff manage assessments" on assessments for all using (is_staff());

-- Documents: own read; staff all
create policy "documents read own" on documents for select
  using (client_id in (select id from clients where auth_user_id = auth.uid()) or is_staff());
create policy "staff manage documents" on documents for all using (is_staff());

-- Articles: any signed-in user reads published; staff manage
create policy "read published articles" on articles for select
  using (published = true and auth.uid() is not null);
create policy "staff manage articles" on articles for all using (is_staff());

-- Assignments: staff only
create policy "staff manage assignments" on client_assignments for all using (is_staff());
create policy "clients read own assignment" on client_assignments for select
  using (client_id in (select id from clients where auth_user_id = auth.uid()));

-- Leads: anyone can submit (insert), staff read/manage
create policy "anyone submits a lead" on leads for insert with check (true);
create policy "staff manage leads"    on leads for all using (is_staff());
