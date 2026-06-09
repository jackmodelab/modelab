-- PLACEHOLDER — history reconciliation only. NOT the real migration SQL.
--
-- The production database's migration history records a migration with version
-- 20260608120000 that has no corresponding file in this repo (it was applied
-- directly to prod — most likely via the Supabase dashboard SQL editor — on
-- 2026-06-08). Its actual SQL was never captured here.
--
-- This stub exists so the local migration history matches the remote history,
-- which the Supabase CLI requires before it will `db push` newer migrations.
-- Because version 20260608120000 is already marked applied on the remote, the
-- CLI will SKIP this file there — it is never executed against prod.
--
-- ⚠ A from-scratch rebuild (`supabase db reset` / a fresh project) will run this
-- no-op and therefore MISS whatever the real 2026-06-08 change did. Recover the
-- real SQL from the prod dashboard (Database → Migrations → 20260608120000) and
-- replace the body below when you can.

do $$ begin end $$;
