# MODE Lab — Security Review & Claude Code Handoff · 2026-06-24

**Reviewer:** Claude (senior-architect + penetration-tester methodology, OWASP-aligned white-box review)
**Scope:** Full Next.js 16 + Supabase app — auth, middleware, all server actions, API route handlers, Supabase RLS migrations, Storage policies, Google OAuth/Calendar, security headers, dependency posture, and the static `/public` marketing pages.
**Method:** Read-only static analysis (the sandbox shell was unavailable, so the app could not be run). Two independent passes — a database/RLS pass and an application/API pass — were run and reconciled.
**Builds on:** `docs/SECURITY_REVIEW_2026-06-20.md` (prior pass: SEC-1/2/3). This pass is an independent fresh audit; overlapping items are reconciled below.

---

## 1. Executive summary

The security posture is **strong and continues to mature**. This is materially above the norm for a small clinical/fitness build: RLS is the primary control on every table, the service-role key is server-only and never bundled to the browser, Google refresh tokens live in Supabase Vault behind service-role-only RPCs, OAuth has a CSRF `state` nonce, open-redirect is handled, uploads are magic-byte-verified, the CSP is enforced (not report-only), and password/secret hygiene is excellent.

**No Critical or High severity issues are live today.** This pass found **9 items**, almost all *defense-in-depth* hardening or *latent* (becomes real only at multi-coach scale). The single genuinely *new* data-integrity gap not covered by any prior pass is **DB-1** (a member can overwrite their own clinician-written `health_notes` via the public API).

### What I changed this pass (low-risk, applied directly to code)

| ID | Severity | Fix | Files |
|----|----------|-----|-------|
| APP-1 | Low | Document download now enforces ownership in **two** layers (app `client_id` filter **+** RLS); member Files page now uses the active-client guard so an archived member can't list file titles | `lib/account/actions.ts`, `app/account/files/page.tsx` |
| APP-2 | Low | Member report viewer now re-checks `status='published' AND shared_with_client` in app code (belt-and-braces behind RLS) so a future RLS change can't leak a draft | `app/account/reports/[id]/page.tsx` |
| APP-7 | Low | Google token/calendar errors no longer inline Google's raw response body into thrown/logged errors (status only) | `lib/google/oauth.ts`, `lib/google/calendar.ts` |
| APP-8 | Low | Member-supplied name/phone/notes are stripped of control chars before being embedded line-by-line in the coach's calendar event (newline-injection spoofing defence) | `lib/google/booking-sync.ts` |

### What needs you / a deliberate, tested change (handoff items below)

| ID | Severity | Item | Type |
|----|----------|------|------|
| **DB-1** | **Medium** | Member can overwrite their own clinician-authored `health_notes` via direct PostgREST | DB migration (SQL ready below) |
| DB-9 | Low | Pin `search_path=''` on `is_staff()` and `handle_new_user()` (match the Vault RPCs) | DB migration (SQL ready below) |
| APP-3 / DB-7 | Medium *(latent)* | No per-coach object-level authz: any active staff can act on any coach's bookings/reports/clients | Code, **gate before 2nd coach** |
| APP-4 | Low | Set `NEXT_PUBLIC_SITE_URL` in every environment; confirm Supabase Redirect URLs have no wildcards | Config / ops |
| APP-6 | Low | In-memory rate limiter is per-instance; move to Upstash/Redis for a global guarantee; add an upload throttle | Code + infra |
| APP-5 | Low | CSP `script-src 'unsafe-inline'`; remove via nonces once static pages are ported to React | Code (future) |
| DB-5 | Low | `articles` "members-only" = any signed-in user (product decision) | Product decision |
| DOC-1 | Info | `docs/BACKEND_SETUP.md` still says file-sharing isn't implemented (it is) | Doc refresh |

> ⚠️ **Per the agreed scope, no database/RLS/auth-logic changes were applied automatically.** The SQL for DB-1 and DB-9 is written and ready below, but must be reviewed, applied with `supabase db push`, and smoke-tested deliberately.

---

## 2. Findings & remediation detail

### DB-1 — Member can overwrite their own clinician-authored `health_notes` · **Medium** · NEW

**Where:** policy `clients update self` (`supabase/migrations/0001_initial_schema.sql:332`); current column guard `protect_client_privileged_columns()` (`supabase/migrations/20260604120000_harden_clients_update.sql:31-59`, extended in `20260609120000_client_archive.sql`); column `clients.health_notes` (`0001_initial_schema.sql:112`).

**What:** `health_notes` is clinician-written PHI (set by staff during `inviteClient`). The `clients update self` policy lets a member update their own row, and the `BEFORE UPDATE` trigger only freezes `discount_tier`, `stripe_customer_id`, `email`, `marketing_consent`, `auth_user_id`, `archived_at`, `archived_by`. It does **not** freeze `health_notes`. A signed-in member using the public anon key directly (bypassing the server actions, which never touch `health_notes`) can `PATCH /rest/v1/clients?id=eq.<own-id>` with a new `health_notes` value and silently erase or falsify the clinical notes the trainer relies on.

**Impact:** Tampering with a clinical record (own row only — not cross-tenant, hence Medium not High). The legitimately self-editable fields (`full_name`, `phone`, `date_of_birth`, `emergency_contact`) are correctly *not* frozen and must stay editable.

**Why it's a handoff item, not auto-applied:** it changes a database trigger. It is additive and low-risk (no member-facing action writes `health_notes`), but DB changes must be applied and smoke-tested deliberately.

**Ready-to-apply migration** — create `supabase/migrations/20260624120000_protect_health_notes.sql`:

```sql
-- Freeze clinician-authored health_notes against member self-edits.
-- health_notes is PHI written only by staff (inviteClient) / service role.
-- No member-facing server action writes it, so adding it to the privileged-
-- column guard cannot break a legitimate flow. Idempotent (create or replace).
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
```

**Smoke test (real member JWT, hitting Supabase directly — not the UI):**
- A member `UPDATE` of their own `health_notes` is **rejected** with `check_violation`.
- A member can still save `full_name`/`phone` via the Profile page and `date_of_birth`/`emergency_contact` via screening.
- Staff can still write `health_notes` (portal client editor).

---

### DB-9 — Pin `search_path=''` on `is_staff()` and `handle_new_user()` · Low

**Where:** `is_staff()` (`0001_initial_schema.sql:311-314`), `handle_new_user()` (`0001_initial_schema.sql:279-287`, and the v2 in `20260620120000_invite_adopt_client_stub.sql`). Contrast the Vault token RPCs (`20260615120000_encrypt_google_tokens.sql`) which correctly use `search_path = ''` + fully-qualified names.

**What:** These two `SECURITY DEFINER` functions use `set search_path = public` rather than `''`. With unqualified table names this is lower-risk than an unpinned path, but `is_staff()` underpins nearly every RLS policy, so it warrants the strongest pinning (`search_path=''` + fully-qualified object names), matching the Vault functions. Behaviour is unchanged.

**Ready-to-apply migration** — create `supabase/migrations/20260624130000_pin_definer_search_path.sql`:

```sql
-- Tighten SECURITY DEFINER search_path to '' and fully-qualify object names,
-- matching the Vault token RPCs. Behaviour unchanged; removes the theoretical
-- search-path-shadowing surface on the functions that back RLS + signup.
create or replace function public.is_staff() returns boolean
language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff
    where auth_user_id = auth.uid() and is_active = true
  );
$$;

-- NOTE: apply to whichever handle_new_user() is current. If 20260620120000_
-- invite_adopt_client_stub.sql replaced it, port THAT body here verbatim and
-- only change the header to `set search_path = ''` + fully-qualified names
-- (public.clients, auth.users). Verify a fresh signup still creates a clients row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.clients (auth_user_id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;
```

> ⚠️ **Check first:** `20260620120000_invite_adopt_client_stub.sql` may already redefine `handle_new_user()` with extra logic (invite adoption). **Read it and port the current body** before applying — do not regress it to the simple version above. Then smoke-test a fresh signup.

---

### APP-3 / DB-7 — No per-coach object-level authorization · Medium (latent; **gate before 2nd coach**)

**Where:** `lib/portal/actions.ts` (`updateBooking`, `acceptBookingRequest`, `declineBookingRequest`, `cancelBooking`, availability + block mutations), `lib/reports/actions.ts` (`updateReport`, `setReportStatus`, `setReportShare`, `deleteReport`); RLS `for all using (is_staff())` on `staff`, `clients`, `bookings`, `assessments`, `documents`, `client_reports`, etc. (`0001_initial_schema.sql` and later).

**What:** Every staff write is gated by `requireStaff()` (confirms an active staff caller) but then operates `.eq('id', id)` with **no check that the row belongs to the calling coach**. Any active staff member can edit/cancel/delete *any* coach's booking, availability, or report for *any* client. This is a **conscious, documented single-operator tradeoff** (`MULTI-COACH:` markers in `lib/portal/actions.ts`) and is safe while Jack is the only operator.

**Why it matters:** the instant a second clinician (e.g. the Como coach) is onboarded, this becomes a real multi-tenant IDOR over PHI (reports especially). **This is the gating prerequisite for multi-coach expansion, not later cleanup.**

**Handoff work (when a 2nd coach is added):**
1. For each staff mutation, load the target row's `staff_id` (bookings/availability/blocks) or resolve the report's client → `client_assignments` and reject if it doesn't match the signed-in `staff.id` (allow an explicit "admin/owner" role to override).
2. Add `with check (is_staff())` to the `for all` policies and, longer term, scope staff-write policies to assigned clients / own rows.
3. Decide and implement a staff role model (owner vs coach).
Touches every staff write path → `[RISKY-NEEDS-TESTING]`, full regression of the portal required.

---

### APP-4 — Host-header trust fallback in `siteOrigin()` / `resolveOrigin()` · Low

**Where:** `lib/site-url.ts:18-29`; `lib/google/oauth.ts:32-35`.

**What:** When `NEXT_PUBLIC_SITE_URL` is unset, the auth-email redirect base is built from the inbound `x-forwarded-host` header (attacker-influenceable). A forged Host could put an off-domain link in a password-reset/invite email. **Mitigated** because Supabase ignores any `redirectTo` not on its Redirect-URLs allow-list, so the realistic worst case is a fallback to the dashboard Site URL — *unless that allow-list contains a wildcard.*

**Fix (config/ops):**
1. Set `NEXT_PUBLIC_SITE_URL` to the canonical domain in **every** environment (prod/preview/local) so the header branch is never reached.
2. In Supabase → Authentication → URL Configuration, confirm Redirect URLs are an explicit list with **no wildcards**.
3. (Optional, code) validate `x-forwarded-host` against an allow-list before trusting it.

---

### APP-6 — Rate limiting is per-instance + uneven coverage · Low

**Where:** `lib/rate-limit.ts`; applied in `lib/auth/actions.ts` and `app/api/leads/route.ts`.

**What:** The limiter is in-memory, so on serverless it throttles per-instance, not globally (it documents this honestly). `clientIp()` trusts `x-forwarded-for[0]` — fine behind Vercel, spoofable if ever fronted differently. Some authenticated endpoints (file upload, screening, OAuth start) have no app-level limit (they require a valid session, so lower risk).

**Fix:** Back the limiter with Upstash/Redis keyed on a trusted IP for a hard guarantee; optionally add a throttle to `uploadClientDocument`. Additive.

---

### APP-5 — CSP `script-src 'unsafe-inline'` · Low (accepted residual)

**Where:** `next.config.mjs:11`. Required for Next's inline hydration bootstrap and the shared static `/public/*.html` pages (no per-request nonce path). Realistically low-impact: no `dangerouslySetInnerHTML` anywhere, all PHI free-text renders as auto-escaped JSX, static pages carry no inline scripts. **Fix (future):** port static pages to React and adopt a per-request nonce to drop `'unsafe-inline'`. Also: any *new* sensitive route added outside `/account` and `/portal` must be added to `isProtected` in `lib/supabase/middleware.ts:39`.

---

### DB-5 — `articles` "members-only" readable by any signed-in user · Low (product decision)

**Where:** `read published articles` (`0001_initial_schema.sql:358-359`). Any authenticated user (incl. archived members / non-paying self-signups) can read all published articles regardless of `members_only`. Not PHI. If `members_only` should require an active membership, tighten the policy (SQL in the DB audit notes); otherwise accept by design.

---

### DOC-1 — Stale backend doc · Info

`docs/BACKEND_SETUP.md` still says client file-sharing isn't implemented. It is (`20260609130000_client_files_storage.sql` + the upload/download paths). Refresh the note.

---

## 3. Reviewed and confirmed solid (do **not** "fix" these)

- Service-role boundary clean: `createSupabaseAdmin()` only in server actions / route handlers / booking-sync, never client-imported; service key never in a `NEXT_PUBLIC_*` var.
- Google refresh tokens in Vault behind service-role-only RPCs; never reach the browser; `requireStaff` avoids `select('*')` to keep revoked Google columns out.
- RLS scopes every PHI table to the owner via `auth.uid()`; staff gated by `is_staff()`. Reports visible to members only when `published` AND `shared_with_client`.
- Server actions re-check auth on every mutation (`requireActiveClient` / `requireStaff`) — they do not rely on the layout guard (replayed-POST aware).
- `getUser()` (verified) used everywhere, never `getSession()` for decisions.
- Open-redirect defence on `?next` in `signIn` and `/auth/callback` (rejects `//`, `/\`).
- OAuth CSRF `state` nonce: `crypto.randomUUID`, httpOnly cookie scoped to `/api/google/oauth`, 600s TTL, verified + cleared on callback.
- File upload: MIME allow-list **+ magic-byte verification**, 25 MB cap, UUID-prefixed path in `<client_id>/`, `upsert:false`. Private bucket; client reads scoped to own folder; 60s `download:true` signed URLs.
- No string-built SQL (parameterised query builder throughout); no `dangerouslySetInnerHTML`/`eval`.
- User-enumeration defences (generic auth errors, always-success reset messaging); 12-char password minimum.
- Security headers comprehensive: enforced CSP, HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy, `object-src 'none'`, `base-uri`/`form-action 'self'`, `poweredByHeader:false`.
- Dependencies current and minimal: Next ^16.2.7, React 19.2, `@supabase/ssr` ^0.5.2, `@supabase/supabase-js` ^2.106, native fetch (no `googleapis`), Node ≥20.

---

## 4. Verification — ACTION REQUIRED

The sandbox shell was unavailable, so the build/type/lint suite and live Supabase smoke tests could **not** be run here. The four applied code fixes were verified by manual review (imports, types, data-flow consistent). Run the following before deploying:

**Build & types**
```bash
npm install
npm run typecheck      # expect: no errors
npm run lint           # expect: no errors
npm run build          # expect: success
```

**Apply the two new migrations (after reviewing the DB-9 handle_new_user note):**
```bash
# create the two files from the SQL in §2 (DB-1, DB-9), then:
supabase db push
```

**Smoke tests for the applied code fixes (use a real member JWT against Supabase directly where noted):**
- APP-1: a member requesting a signed URL for a **document that isn't theirs** returns "File not found." (now blocked in app code as well as RLS); an archived member is redirected away from `/account/files`.
- APP-2: a member opening a report URL whose row is a **draft / not shared** gets a 404 (not the document).
- APP-7: trigger a Google token failure → server log shows `... failed (NNN)` with **no** Google response body.
- APP-8: set a member's notes/name to a value containing newlines → the coach's calendar event description shows it on a **single line** (no forged extra fields).
- Regression: member can still book a valid slot, view bookings, download their own files; staff portal + coach picker still load; a fresh signup still creates a `clients` row.

**Smoke tests for the DB handoff items:** see DB-1 and DB-9 above.

---

## 5. Suggested order of work

1. **Now (this pass):** run the verification suite for the 4 applied fixes; deploy.
2. **Now (small, high value):** apply DB-1 migration (clinical-record integrity) + DB-9 migration (RLS hardening); smoke-test.
3. **Config:** set `NEXT_PUBLIC_SITE_URL` everywhere; audit Supabase Redirect URLs (APP-4).
4. **Before any 2nd coach:** implement per-coach authorization + staff role model (APP-3/DB-7). **Hard prerequisite.**
5. **When scaling traffic:** Redis-backed rate limiter (APP-6).
6. **Backlog:** CSP nonces (APP-5), `articles` gating decision (DB-5), refresh `BACKEND_SETUP.md` (DOC-1).
