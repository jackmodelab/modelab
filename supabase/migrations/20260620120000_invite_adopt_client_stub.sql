-- supabase/migrations/20260620120000_invite_adopt_client_stub.sql
-- Invite-client flow: let a new auth user ADOPT an existing staff-created client
-- stub that shares their email, instead of failing on the clients.email unique
-- constraint.
--
-- Before: handle_new_user() always INSERTed a clients row. If staff had already
-- added that person as a walk-in record (clients row, auth_user_id NULL), the
-- insert hit the `email` unique constraint and the whole auth.users insert rolled
-- back — so inviteUserByEmail() (and plain self-signup) errored for any email
-- already on file.
--
-- After: if a login-less stub with the same email exists, link it to the new auth
-- user (preserving any name already captured); otherwise insert a fresh row as
-- before. The `auth_user_id is null` guard means an already-claimed account is
-- never re-pointed at a different user.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
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
