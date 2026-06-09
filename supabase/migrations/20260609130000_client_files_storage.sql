-- Client file sharing — private Storage bucket + RLS.
--
-- The `documents` table (0001_initial_schema.sql) and its table-level RLS
-- ("documents read own" / "staff manage documents") already exist. This adds
-- the missing storage layer so staff can upload files for a client and the
-- client can download only their own.
--
-- Object path convention (enforced by the upload server action):
--     <client_id>/<uuid>-<safe-filename>
-- so the first path segment is the owning client id and the client read policy
-- can scope on it.
--
-- Idempotent: on-conflict insert + drop-if-exists/create policies.

-- Private bucket (no public URLs; access only via signed URLs).
insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

-- Staff: full read/write on everything in the bucket.
drop policy if exists "client-files staff all" on storage.objects;
create policy "client-files staff all" on storage.objects
  for all
  using (bucket_id = 'client-files' and is_staff())
  with check (bucket_id = 'client-files' and is_staff());

-- Clients: read only objects whose first path segment is one of their own
-- client ids (a client row is keyed to the signed-in auth user).
drop policy if exists "client-files client reads own" on storage.objects;
create policy "client-files client reads own" on storage.objects
  for select
  using (
    bucket_id = 'client-files'
    and (storage.foldername(name))[1] in (
      select id::text from clients where auth_user_id = auth.uid()
    )
  );
