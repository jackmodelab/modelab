-- Harden the client self-update path.
--
-- 0001_initial_schema.sql created:
--   create policy "clients update self" on clients for update
--     using (auth.uid() = auth_user_id);
-- It has a USING clause but NO WITH CHECK, and Postgres RLS cannot reference the
-- OLD row inside WITH CHECK. So a signed-in client using the anon key directly
-- (bypassing our server actions) could rewrite privileged columns on their own
-- row: discount_tier (pricing depends on it!), stripe_customer_id, email,
-- marketing_consent — i.e. "set my own discount".
--
-- Column-level REVOKEs are too blunt here: staff edit clients through the same
-- `authenticated` role as members, so revoking column UPDATE would also block
-- staff. Instead we fix it in two layers:
--   1) Re-create the policy WITH CHECK so the post-update row must still belong
--      to the same auth user (a client can't repoint their row to someone else).
--   2) A BEFORE UPDATE trigger that hard-rejects any change to a privileged
--      column unless the writer is an active staff member or the service role.
--      Legit client self-edits (full_name, phone, date_of_birth,
--      emergency_contact — written by updateProfile and the screening action)
--      are unaffected.
--
-- Idempotent: drop-if-exists + create-or-replace, safe to re-run or partially
-- apply (the Supabase SQL editor aborts a batch at the first error).

drop policy if exists "clients update self" on clients;
create policy "clients update self" on clients for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create or replace function protect_client_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Active staff and the service role (admin client, seed scripts, any future
  -- payment webhook) may change anything.
  if is_staff() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  -- Otherwise the writer is the owning client via their own JWT. Privileged
  -- columns must not move. NB: if a consented marketing-preference action is
  -- added later, route it through the service-role client so it lands here in
  -- the allowed branch above.
  if new.discount_tier      is distinct from old.discount_tier
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.email             is distinct from old.email
     or new.marketing_consent is distinct from old.marketing_consent
     or new.auth_user_id      is distinct from old.auth_user_id then
    raise exception 'clients: privileged columns are not self-editable'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_clients_protect_privileged on clients;
create trigger trg_clients_protect_privileged
  before update on clients
  for each row execute function protect_client_privileged_columns();
