-- DB-9 — Tighten SECURITY DEFINER search_path to '' and fully-qualify object
-- names on the two functions that back RLS + signup, matching the Vault token
-- RPCs (20260615120000_encrypt_google_tokens.sql). Behaviour is unchanged; this
-- only removes the theoretical search-path-shadowing surface on is_staff()
-- (which underpins nearly every RLS policy) and handle_new_user().

-- is_staff(): unchanged logic, now search_path='' + public.staff fully-qualified.
create or replace function public.is_staff() returns boolean
language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff
    where auth_user_id = auth.uid() and is_active = true
  );
$$;

-- handle_new_user(): the CURRENT body is the invite-adopt version
-- (20260620120000_invite_adopt_client_stub.sql), NOT the simple insert from
-- 0001. Ported here verbatim — tables are already schema-qualified
-- (public.clients), so it is safe under search_path=''. Do not regress it to the
-- single-insert form. The on_auth_user_created trigger keeps binding to this
-- function across the create-or-replace.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Adopt a staff-created stub (no login yet) for this email, if one exists.
  update public.clients
     set auth_user_id = new.id,
         full_name = coalesce(full_name, new.raw_user_meta_data->>'full_name')
   where email = new.email
     and auth_user_id is null;

  -- No stub to adopt → create the row, as the original trigger did.
  if not found then
    insert into public.clients (auth_user_id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', null))
    on conflict (auth_user_id) do nothing;
  end if;

  return new;
end;
$$;
