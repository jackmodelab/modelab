-- DB-1 — Freeze clinician-authored health_notes against member self-edits.
--
-- health_notes is PHI written only by staff (inviteClient) / the service role.
-- The `clients update self` policy lets a member UPDATE their own row, and the
-- BEFORE UPDATE guard (20260604120000_harden_clients_update.sql, extended in
-- 20260609120000_client_archive.sql) froze discount_tier, stripe_customer_id,
-- email, marketing_consent, auth_user_id, archived_at, archived_by — but NOT
-- health_notes. So a signed-in member using the anon key directly (bypassing the
-- server actions, which never touch health_notes) could PATCH their own row and
-- silently erase or falsify the clinical notes the trainer relies on.
--
-- No member-facing server action writes health_notes, so adding it to the
-- privileged-column guard cannot break a legitimate flow. The genuinely
-- self-editable fields (full_name, phone, date_of_birth, emergency_contact) are
-- deliberately left OUT of the list and stay editable.
--
-- Idempotent (create or replace). Body mirrors the current guard
-- (20260609120000) verbatim with health_notes appended to the frozen set.

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
     or new.archived_by       is distinct from old.archived_by
     or new.health_notes      is distinct from old.health_notes then
    raise exception 'clients: privileged columns are not self-editable'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
