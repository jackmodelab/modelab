-- Client archive (soft-delete) support.
--
-- Staff can ARCHIVE a client — they keep all their data but drop out of the
-- active directory, booking pickers and the ⌘K palette, and lose access to the
-- member portal until reactivated. Reactivation (a staff action) restores the
-- row and emails the client a fresh sign-in link. Hard DELETE is separate and
-- happens via auth.admin.deleteUser (cascades through the FK graph).
--
-- Idempotent: add-column-if-not-exists + create-or-replace, safe to re-run.

alter table clients add column if not exists archived_at timestamptz;
alter table clients add column if not exists archived_by uuid references staff(id) on delete set null;

-- Partial-friendly index for the common "active clients only" filter.
create index if not exists idx_clients_active on clients(archived_at);

-- Extend the privileged-column guard (20260604120000_harden_clients_update.sql)
-- so a signed-in client can't archive/un-archive themselves via a direct anon
-- write — only active staff or the service role may move archive state.
create or replace function protect_client_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_staff() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if new.discount_tier      is distinct from old.discount_tier
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.email             is distinct from old.email
     or new.marketing_consent is distinct from old.marketing_consent
     or new.auth_user_id      is distinct from old.auth_user_id
     or new.archived_at       is distinct from old.archived_at
     or new.archived_by       is distinct from old.archived_by then
    raise exception 'clients: privileged columns are not self-editable'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
