# MODE Lab — Backend Setup

This connects the app to Supabase and creates your **test accounts**. Everything
is already coded — you just need a Supabase project and ~10 minutes.

## What's built (this slice)

- **Next.js 14** app (the marketing pages still live as static files in `/public`).
- **Supabase Auth** — email + password sign-in / sign-up, session refresh in middleware.
- **Postgres schema** with Row Level Security: clients, staff, services, packages,
  bookings, client_packages, assessments, documents, articles, availability,
  assignments, leads.
- **Members area** (`/account`) — bookings (upcoming/history), packages & sessions
  remaining, research articles. Reads real data; RLS-scoped to the user.
- **Employee portal** (`/portal`) — clients list, upcoming schedule, availability.
  Staff-only.
- **Seed script** that creates a test member + test staff with sample data.

> Launch posture: payment is **in-studio** (no online checkout). Client file
> sharing is **hidden** until the private Storage bucket + policies are built.
> Coming next: Stripe checkout and the file-upload / report-builder actions.

---

## Step 1 — Create a Supabase project

1. Go to <https://supabase.com> → **New project** (free tier is fine).
2. Pick a region close to you (e.g. **Sydney**). Set a strong database password.
3. Wait for it to finish provisioning.

## Step 2 — Copy your keys into `.env.local`

In the dashboard: **Project Settings → API**. Copy these into `.env.local`
(replace the placeholder values):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>   # keep secret, server-only
SUPABASE_PROJECT_ID=<your-ref>
```

The test-account names/passwords are already in `.env.local`:

```
TEST_CLIENT_EMAIL=client@modelab.test   TEST_CLIENT_PASSWORD=ModeLab!2026
TEST_STAFF_EMAIL=jack@modelab.test      TEST_STAFF_PASSWORD=ModeLab!2026
```

## Step 3 — Apply the schema

**Use the CLI — it applies _every_ migration in `supabase/migrations/` in order.**
This matters: beyond the initial schema and seed catalog there are later
migrations for pre-screening, Google Calendar, the **secure-tokens fix** (moves
the Google refresh token off the public-readable `staff` table) and the
**clients RLS hardening**. Applying only `0001`/`0002` by hand silently skips all
of those.

```bash
supabase link --project-ref <your-ref>
supabase db push
```

After it runs, sanity-check that the security migrations landed:

- `staff_google_credentials` and `client_screenings` tables exist.
- `staff.google_refresh_token` **no longer exists** (it moved to
  `staff_google_credentials`).

> If you must use the Supabase **SQL Editor** instead of the CLI, paste **every**
> file in `supabase/migrations/` in filename order (not just the first two) —
> otherwise you ship without the token-security and RLS fixes.

## Step 4 — Seed the test accounts

```bash
npm run seed:test
```

You should see:

```
✓ Seed complete.
  Member  → client@modelab.test / ModeLab!2026
  Staff   → jack@modelab.test  / ModeLab!2026
```

The script is **idempotent** — safe to run again; it clears prior test data first.

## Step 5 — Run it

```bash
npm run dev
```

- <http://localhost:3000/login>
- Sign in as **client@modelab.test** → lands on `/account` (member dashboard with
  sample bookings, a 45-min package, research articles).
- Sign in as **jack@modelab.test** → lands on `/portal` (staff portal: clients,
  schedule, availability).

---

## Test accounts

| Role | Email | Password | Lands on |
|------|-------|----------|----------|
| Member | `client@modelab.test` | `ModeLab!2026` | `/account` |
| Staff  | `jack@modelab.test`   | `ModeLab!2026` | `/portal` |

> The staff account is "staff" because the seed inserts a row in the `staff` table
> linked to its auth user. Anyone who signs up normally becomes a **member** (a
> `clients` row is auto-created by the `handle_new_user` trigger).

## Notes & gotchas

- **Email confirmation:** the seed sets `email_confirm: true`, so test accounts work
  immediately. For real public sign-ups, Supabase sends a confirmation email; the
  `/auth/callback` route handles the redirect back.
- **Shared files** are seeded as metadata rows with placeholder `storage_path`s,
  but the feature is **hidden in the UI** for launch — the private `client-files`
  Storage bucket and its access policies don't exist yet. Don't surface the files
  UI until that bucket + Storage RLS + a client-scoped download path are built.
- **Regenerate DB types** anytime the schema changes: `npm run db:types`
  (overwrites `types/database.ts` with exact generated types).
- **Never commit `.env.local`** — it's gitignored. The `service_role` key bypasses
  RLS and must stay server-side.
