-- Encrypt the Google OAuth refresh token at rest (FIX-4).
--
-- `staff_google_credentials.refresh_token` was plaintext `text`. The table is
-- already service-role-only (no anon/authenticated RLS policy — see
-- 20260601090000_secure_google_tokens.sql), so this is defense-in-depth: even a
-- raw DB dump / leaked backup no longer exposes a usable token.
--
-- Approach: store each coach's refresh token in Supabase Vault (pgsodium-backed,
-- key managed outside the row) and keep only the secret's UUID on the table. The
-- app reaches the plaintext exclusively through two `security definer` RPCs that
-- live in the API-exposed `public` schema (the `vault` schema is not exposed via
-- PostgREST). EXECUTE is granted to `service_role` only.
--
-- Idempotent: safe to re-run / partially-applied (the Supabase SQL editor aborts
-- a batch at the first error, so every step guards against an earlier partial run).

create extension if not exists supabase_vault;

-- 1. Add the secret-id column (the plaintext column is dropped at the end, once
--    existing rows are migrated into the vault).
alter table staff_google_credentials
  add column if not exists refresh_token_secret_id uuid;

-- 2. Writer: create-or-update the coach's vault secret and pin its id on the row.
--    `search_path = ''` + fully-qualified names so the definer body can't be
--    hijacked by a caller-controlled search_path.
create or replace function public.set_staff_google_refresh_token(p_staff_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_name text := 'google_refresh_token:' || p_staff_id::text;
begin
  if p_token is null or length(p_token) = 0 then
    raise exception 'refresh token must not be empty';
  end if;

  -- Reuse the existing secret if the row already points at one, else fall back to
  -- a secret already named for this coach (covers a half-applied earlier run).
  select refresh_token_secret_id into v_secret_id
  from public.staff_google_credentials
  where staff_id = p_staff_id;

  if v_secret_id is null then
    select id into v_secret_id from vault.secrets where name = v_name;
  end if;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(p_token, v_name, 'Google OAuth refresh token (per-coach)');
  else
    perform vault.update_secret(v_secret_id, p_token);
  end if;

  insert into public.staff_google_credentials (staff_id, refresh_token_secret_id)
  values (p_staff_id, v_secret_id)
  on conflict (staff_id) do update set refresh_token_secret_id = excluded.refresh_token_secret_id;
end;
$$;

-- 3. Reader: return the decrypted token, or null when the coach hasn't connected.
create or replace function public.get_staff_google_refresh_token(p_staff_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select ds.decrypted_secret into v_token
  from public.staff_google_credentials c
  join vault.decrypted_secrets ds on ds.id = c.refresh_token_secret_id
  where c.staff_id = p_staff_id;
  return v_token;
end;
$$;

-- 4. When a credentials row goes away (e.g. staff deleted → ON DELETE CASCADE),
--    drop the orphaned vault secret too.
create or replace function public.cleanup_google_refresh_token_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.refresh_token_secret_id is not null then
    delete from vault.secrets where id = old.refresh_token_secret_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_google_refresh_token_secret on staff_google_credentials;
create trigger trg_cleanup_google_refresh_token_secret
  after delete on staff_google_credentials
  for each row execute function public.cleanup_google_refresh_token_secret();

-- 5. Lock down the RPCs: service-role only (never anon/authenticated).
revoke all on function public.set_staff_google_refresh_token(uuid, text) from public;
revoke all on function public.get_staff_google_refresh_token(uuid) from public;
grant execute on function public.set_staff_google_refresh_token(uuid, text) to service_role;
grant execute on function public.get_staff_google_refresh_token(uuid) to service_role;

-- 6. Migrate any plaintext tokens already on the table into the vault, then drop
--    the plaintext column. Guarded on the column still existing so a re-run after
--    the drop is a no-op.
do $$
declare
  r record;
  v_secret_id uuid;
  v_name text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff_google_credentials'
      and column_name = 'refresh_token'
  ) then
    for r in
      execute 'select staff_id, refresh_token from public.staff_google_credentials
               where refresh_token is not null and refresh_token_secret_id is null'
    loop
      v_name := 'google_refresh_token:' || r.staff_id::text;
      select id into v_secret_id from vault.secrets where name = v_name;
      if v_secret_id is null then
        v_secret_id := vault.create_secret(r.refresh_token, v_name, 'Google OAuth refresh token (per-coach)');
      end if;
      update public.staff_google_credentials
        set refresh_token_secret_id = v_secret_id
        where staff_id = r.staff_id;
    end loop;
  end if;
end $$;

alter table staff_google_credentials drop column if exists refresh_token;
