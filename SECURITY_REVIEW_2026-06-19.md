# MODE Lab — Security Review & Penetration Test

**Target:** `modelab` web application (Next.js 16 + Supabase) — repo + production site `https://www.modelab.com.au`
**Date:** 19 June 2026
**Reviewer:** Claude (senior-architect + penetration-tester methodology)
**Authorisation:** Owner-authorised, non-destructive testing of the owner's own production site. Read-only probing only; no data created, modified, or deleted; no load/DoS testing; no automated exploit scanners.

---

## 1. Executive summary

The application is **well-built and security-conscious**. The codebase shows deliberate, layered defences — validated server-side sessions, row-level security (RLS) on every table, a privileged-column-protection trigger, OAuth refresh tokens encrypted in Supabase Vault, OAuth state CSRF protection, open-redirect and user-enumeration defences, a full security-header set, and a database-level booking-overlap constraint.

**No Critical or High-severity issues were found** in either the static review or the live test. The findings are one Medium (a deliberately-deferred multi-coach authorisation gap) and a handful of Low / Informational hardening items.

A live probe of the production Supabase API with the public anon key confirmed that **every protected table denies anonymous reads** — the most important real-world check passed.

> **Scope caveat.** "Completely safe" is not an achievable end-state for any live system; security is ongoing risk reduction. This review is a point-in-time assessment. The highest-value *recurring* control is to keep the RLS posture and dependency patching that the app already has in place, and to close the multi-coach gap **before** a second coach is added.

### Findings at a glance

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| F-1 | **Medium** | Multi-coach authorisation gap (BOLA/IDOR within the staff role) — staff write paths act by `id` with no per-coach ownership check | Documented & accepted for single operator; **must fix before 2nd coach** |
| F-2 | **Low** | `staff` table exposes `auth_user_id` + `google_calendar_email`/`_connected_at` columns to the anonymous key | **Confirmed live** |
| F-3 | **Low** | Production CSP allows `script-src 'unsafe-inline'` | Confirmed live |
| F-4 | **Low** | Client file upload has no content-type/extension allowlist | Static |
| F-5 | **Low** | Rate limiting is in-memory/per-instance and keyed on a spoofable IP header | Static |
| F-6 | **Low** | Minor info disclosure: `x-powered-by: Next.js`; no `robots.txt` | Confirmed live |
| F-7 | **Info** | Weak password policy (min 8 chars, no breach check) | Static |
| F-8 | **Info** | Dev/maintenance scripts run against production with the service-role key | Static |
| F-9 | **Info** | No automated dependency scanning / CI security gates observed | Static |
| F-10 | **Info** | Member bookings are written with the service-role client (by design; well-validated) | Static — no action required |

**Risk tally:** 0 Critical · 0 High · 1 Medium · 5 Low · 4 Informational

> **Remediation status — 2026-06-19 (code pass).** Applied in code (lint + `tsc` clean, adversarially reviewed): **F-2 ✅, F-4 ✅, F-6 ✅, F-7 ◐** (code done; Supabase-dashboard leaked-password toggle still outstanding), **F-8 ✅, F-9 ✅** — see `SECURITY_REMEDIATION_HANDOFF.md` for per-task detail. **F-1, F-3, F-5** left deferred by prior product/architecture decisions. ⚠ **The F-2 fix (migration `20260619120000_staff_anon_column_grants.sql`) must still be applied to production.** F-10 = no action by design.

---

## 2. Scope & methodology

**In scope**
- Full static review of the application source: auth, middleware, server actions, API routes, the Supabase data layer (12 migrations / RLS), config, secrets handling, and dependencies.
- Live, non-destructive testing of `https://www.modelab.com.au`: security headers, TLS/redirects, route protection, role separation, client-bundle secret exposure, and the Supabase RLS boundary (anonymous reads against all tables using the public anon key).

**Not tested** (recommended as follow-ups)
- Authenticated *member-vs-member* IDOR at the live API layer (would require two seeded member sessions; the underlying RLS policy was instead verified statically and via the anonymous-read probe).
- Automated vulnerability scanning, fuzzing, and load/DoS testing (deliberately excluded as out-of-scope / potentially disruptive on production).
- Live write-path RLS (no anon insert/update was attempted on production to avoid writing junk data; verified statically — no anon write policy exists on protected tables).
- Supabase dashboard / project-level settings (auth config, leaked-password protection, network restrictions) — recommend an owner self-check; see F-7.

**Tooling:** source read/grep; `WebSearch` for dependency CVE status; `web_fetch` for unauthenticated route checks; Claude-in-Chrome for live header inspection and the authenticated/anonymous Supabase probe.

---

## 3. Findings

### F-1 — Multi-coach authorisation gap (BOLA/IDOR within the staff role) · **Medium**

**Location:** `lib/portal/actions.ts` (e.g. `updateBooking`, `acceptBookingRequest`, `declineBookingRequest`, `cancelBooking`, `addAvailability`/`updateAvailability`/`deleteAvailability`/`toggleAvailability`, `createBlock`/`deleteBlock`), `lib/reports/actions.ts` (`updateReport`, `setReportStatus`, `setReportShare`, `deleteReport`).

**Detail:** These server actions require an active staff member (`requireStaff()`) but then act on a row purely by its `id` with **no check that the row belongs to the acting coach**. Any active staff member could therefore edit, cancel, accept, decline, or delete *any* coach's booking/availability/report. The shared client list behaves the same way. This is **explicitly documented and accepted in the code** (`MULTI-COACH:` comments) as a reasonable trade-off for a single-operator studio.

**Impact:** Negligible today (one trusted operator). It becomes a real **broken-object-level-authorisation** issue the moment a second coach is onboarded — and the seed data already lists a second location (`Como`, `coming_soon`).

**Recommendation:** Before the second coach goes live, scope every staff write to the owning coach: load the row's `staff_id`, compare to the signed-in `staff.id`, and reject a mismatch (or allow only via a `client_assignments` link). The DB already has a `client_assignments` table to support this. See handoff task **T-1**.

---

### F-2 — `staff` table leaks `auth_user_id` and Google-calendar columns to anonymous callers · **Low** · *confirmed live*

**Location:** `0001_initial_schema.sql` → `create policy "public reads active staff" on staff for select using (is_active = true)`; columns added in `20260530140000_staff_google_calendar.sql`.

**Detail:** RLS is row-level, not column-level. The public read policy returns the **whole** active-staff row to the anonymous key. The live probe confirmed an anonymous caller receives `auth_user_id` (present) plus the `google_calendar_email` and `google_calendar_connected_at` columns. The Google fields are currently null (no coach has linked Calendar), so nothing sensitive leaks *yet* — but **the coach's Google email becomes anonymously readable as soon as Calendar is connected.** (The dangerous refresh token was already correctly moved off this table into the service-role-only `staff_google_credentials` table — good.)

**Evidence (live, anon key):** `GET /rest/v1/staff?select=auth_user_id,google_calendar_email,...` → `200`, columns present in the response.

**Recommendation:** Stop serving these columns to anon. Either (a) move `google_calendar_email`/`_connected_at` into `staff_google_credentials` (service-role only), or (b) expose public coach profiles through a dedicated view (`display_name`, `title`, `bio`, `credentials` only) and restrict anon `select` on the base table. See handoff task **T-2**.

---

### F-3 — Production CSP allows `script-src 'unsafe-inline'` · **Low** · *confirmed live*

**Location:** `next.config.mjs`.

**Detail:** The deployed CSP is otherwise strong (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, no `unsafe-eval` in production). But `script-src 'self' 'unsafe-inline'` means that *if* an XSS sink were ever introduced, CSP would not block an injected inline script. Currently mitigated by React's auto-escaping and the absence of any `dangerouslySetInnerHTML` in the codebase.

**Recommendation:** Move to a nonce-based `script-src` for the Next app routes (drop `'unsafe-inline'`), serving the static `/public/*.html` pages with their own header if needed. See handoff task **T-3**.

---

### F-4 — Client file upload lacks a content-type / extension allowlist · **Low**

**Location:** `lib/portal/actions.ts` → `uploadClientDocument`.

**Detail:** Uploads are staff-only, capped at 25 MB, stored under a random path in a **private** bucket, and only ever served via short-lived signed URLs with `download: true` (which neutralises stored-XSS-via-view). However, the content type is taken from the client (`file.type`) and there is no allowlist, so arbitrary file types can be stored and later handed to a client.

**Recommendation:** Enforce an allowlist (e.g. PDF, PNG/JPG, common doc types), validate by magic-bytes (not just the client-supplied MIME), and consider antivirus scanning for shared files. See handoff task **T-4**.

---

### F-5 — In-memory, per-instance rate limiting on a spoofable IP key · **Low**

**Location:** `lib/rate-limit.ts`, used by `lib/auth/actions.ts` and `app/api/leads/route.ts`.

**Detail:** The limiter is a per-process `Map`, so on serverless it throttles per-instance, not globally, and resets on cold start. The key is the first `x-forwarded-for` hop. On Vercel this header is platform-controlled (so spoofing is not a concern *there*), and the design is explicitly "best-effort" alongside the honeypot and Supabase's own auth throttling. Adequate for launch scale; not a hard quota.

**Recommendation:** For a real guarantee, back the limiter with a shared store (e.g. Upstash/Redis) and confirm the trusted-proxy IP handling for the deployment. See handoff task **T-5**.

---

### F-6 — Minor information disclosure · **Low** · *confirmed live*

**Detail:** Production responses include `x-powered-by: Next.js` (reveals the framework) and `x-vercel-id` (reveals the hosting region). There is no `robots.txt`.

**Recommendation:** Set `poweredByHeader: false` in `next.config.mjs`; add a `robots.txt`. Cosmetic; low priority. See handoff task **T-6**.

---

### F-7 — Weak password policy · **Info**

**Detail:** Sign-up enforces only an 8-character minimum (`lib/auth/actions.ts`), with no complexity or breached-password check.

**Recommendation:** Raise the minimum to 10–12 and enable Supabase Auth's **leaked-password protection** (HaveIBeenPwned) in the project's Auth settings. See handoff task **T-7**.

---

### F-8 — Dev/maintenance scripts target production with the service-role key · **Info**

**Location:** `scripts/purge-test-users.mjs` (and the gitignored `seed-*.mjs`).

**Detail:** The purge script reads the service-role key from `.env.local` and, per its own comment, "targets whatever project that file points at (currently production)." It is carefully guarded to only `@modelab.test` addresses, but running destructive maintenance scripts against production is risky.

**Recommendation:** Use a separate staging project for seeding/testing, and add an explicit guard that refuses to run against the production URL. See handoff task **T-8**.

---

### F-9 — No automated dependency scanning / CI security gates observed · **Info**

**Detail:** Dependencies are **current and patched** — the lockfile pins `next@16.2.7`, which is past `16.2.6` and therefore not affected by the May-2026 Next.js advisory batch (incl. the CVSS 8.6 WebSocket SSRF, CVE-2026-44578) nor by the 2025 middleware-bypass CVE-2025-29927. There is no evidence of automated, ongoing scanning to keep it that way.

**Recommendation:** Add `npm audit`/Dependabot and run `npm run lint` + `tsc --noEmit` in CI; keep Next ≥ 16.2.6. See handoff task **T-9**.

---

### F-10 — Member bookings use the service-role client · **Informational / by design**

**Detail:** Members have no RLS insert path into `bookings`, so `requestBooking`/`requestCustomBooking` insert via the service-role client. This is compensated by thorough server-side validation (active service/location/coach, availability-window fit, overlap check), the booking-overlap DB exclusion constraint, and the fact that `client_id` is taken from the authenticated session (a member cannot book as someone else). **No action required**; keep the validation as the security boundary and cover it with tests.

---

## 4. Live penetration-test results

| Test | Result |
|------|--------|
| HTTPS / TLS serving | ✅ Pass |
| Security headers in prod (CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy) | ✅ Present (CSP weak point: F-3) |
| `/account`, `/account/*`, `/portal`, `/portal/*` redirect unauthenticated users to `/login` | ✅ Pass |
| Member→staff role separation (member hitting `/portal` is bounced to `/account`) | ✅ Pass |
| Secret exposure in client bundle (anon key / `service_role`) | ✅ None — app makes **zero** client-side Supabase calls |
| `.env` exposure / `GET /api/leads` handler | ✅ None (`.env` not served; leads is POST-only) |
| **Supabase RLS — anonymous reads of protected tables** | ✅ **All denied (0 rows):** `clients`, `client_packages`, `bookings`, `assessments`, `documents`, `client_assignments`, `leads`, `client_screenings`, `client_reports`, `staff_blocks`, `articles`, `staff_google_credentials` |
| Supabase RLS — public catalog (`locations`, `services`, `packages`, `staff`, `staff_availability`) | ✅ Readable as intended (note column exposure on `staff`: F-2) |

---

## 5. Strengths (defences confirmed in place)

- Server-validated sessions via `supabase.auth.getUser()` in `requireClient`/`requireStaff`; route protection enforced in middleware **and** in every server action/page (defence in depth — a middleware bypass would not leak data).
- RLS enabled on **all** tables; `is_staff()` / `handle_new_user()` / privileged-column trigger are `SECURITY DEFINER` with a pinned `search_path`.
- A `BEFORE UPDATE` trigger + `WITH CHECK` blocks clients from self-editing privileged columns (`discount_tier`, `stripe_customer_id`, `email`, `marketing_consent`, `auth_user_id`, archive state) even via the raw anon key.
- Google OAuth: anti-CSRF `state` nonce; refresh tokens encrypted in Supabase Vault and reachable only via a service-role RPC; never sent to the browser.
- Open-redirect defences on `next` (login + auth callback); generic auth errors to prevent user enumeration; honeypot + rate limit on the public lead form.
- Private storage bucket with path-scoped client read policy; signed-URL downloads only.
- Database-level booking-overlap exclusion constraint backstops the application double-booking check.
- Comprehensive security headers; current, patched dependencies; clean secret hygiene (`.gitignore` blocks env/keys; no secrets committed; no `service_role` key in the client bundle).

---

## 6. Recommended priority order

1. **T-1 (F-1)** — Add per-coach ownership scoping **before** onboarding the second coach (Como).
2. **T-2 (F-2)** — Stop exposing `staff.auth_user_id` / Google-calendar columns to anon (do this **before** any coach connects Google Calendar).
3. **T-3 (F-3)** — Nonce-based CSP; drop `script-src 'unsafe-inline'`.
4. **T-4 (F-4)** — File-upload allowlist + magic-byte validation.
5. **T-7 (F-7)** — Enable leaked-password protection + raise the minimum length.
6. **T-5, T-6, T-8, T-9** — Distributed rate limiting, info-disclosure cleanup, staging separation for scripts, CI dependency scanning.

The detailed, code-level remediation steps are in **`SECURITY_REMEDIATION_HANDOFF.md`**, formatted for Claude Code.

*This document reflects testing performed on 19 June 2026 and does not guarantee the absence of all vulnerabilities. Re-test after remediation and after any significant change (especially the second-coach rollout and any Stripe/payments integration).*
