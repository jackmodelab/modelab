# MODE Lab — Security Review & Remediation · 2026-06-20

**Reviewer:** Claude (senior-architect + penetration-tester methodology, OWASP-aligned white-box review)
**Scope:** Full Next.js 14 app — auth, middleware, server actions, API route handlers, Supabase RLS migrations, Storage policies, Google OAuth, security headers, and the static `/public` marketing pages.
**Build/deploy state:** All changes below are **staged in the repo** (code + two new migrations). They are **not yet built or applied** — see *Verification* at the end.

---

## 1. Executive summary

The security **foundation is strong** and shows the effect of two prior passes (2026-06-04 handoff, 2026-06-19 pen-test): RLS on every table, the service-role key is server-only, Google refresh tokens are in Vault, OAuth has CSRF `state`, open-redirect is handled, uploads are magic-byte-checked, CSP is enforced, and secrets hygiene is excellent.

This pass found **3 remaining issues**, all now fixed, plus one stale doc note. None were Critical/High. The theme of all three: **a guard enforced in one layer (UI / one role) but not re-enforced at the layer an attacker actually reaches** (server actions, direct PostgREST).

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| SEC-1 | **Medium** | Archived (deactivated) members can still invoke member server actions (book, cancel, edit profile, screening, file URLs) by calling them directly | ✅ Fixed |
| SEC-2 | **Low–Medium** | Members can rewrite *any* column of their own `bookings` via the public API (time, coach, status), bypassing availability/lead-time checks | ✅ Fixed |
| SEC-3 | **Low** | Any signed-in **member** could read every coach's `google_calendar_email` / `_connected_at` via direct PostgREST (the 06-19 fix only covered anonymous users) | ✅ Fixed |
| DOC-1 | Info | `BACKEND_SETUP.md` still says file-sharing is "hidden / bucket doesn't exist" — it's now implemented | Noted (not changed) |

---

## 2. Findings & remediation

### SEC-1 — Archived members bypass deactivation via server actions · Medium

**What:** Archiving a client is meant to revoke portal access ("lose access to the member portal until reactivated"). That was enforced **only in `app/account/layout.tsx`**, which short-circuits page renders to an "inactive" notice. But Next.js layouts do not protect Server Actions — the action endpoints stay live, and an archived member keeps a valid session (archiving doesn't sign them out or disable the auth user). The member-mutation actions (`requestBooking`, `requestCustomBooking`, `cancelMemberBooking`, `updateProfile`, `submitScreening`, `getMyDocumentSignedUrl`) only called `requireClient`, which does **not** check `archived_at`.

**Impact:** A deactivated member (e.g. removed for non-payment / banned) could keep self-booking sessions, cancelling, editing their profile, submitting screening, and minting signed download URLs for their own files — by replaying the action POSTs from the browser console.

**Fix:** Added `requireActiveClient()` in `lib/auth/guards.ts` (= `requireClient` + redirect to `/account` when `archived_at` is set, where the layout shows the inactive notice). Routed every member **mutation** through it (`lib/account/actions.ts`, `lib/screening/actions.ts`). Read-only pages keep `requireClient` so the inactive notice still renders.

### SEC-2 — Members can arbitrarily edit their own bookings via direct API · Low–Medium

**What:** `0001_initial_schema.sql` created `"bookings update own" for update using (client_id in (… auth.uid()))` with no column restriction. A signed-in member using the public key directly (not the UI) could `UPDATE` any column of their own booking: move it to a different time or coach, flip `status` to `confirmed`/`completed`/`no_show`, or rewrite notes — bypassing the availability, lead-time and ownership logic the server actions enforce. (They could *not* reassign a booking to another member — the `USING` is reused as the `WITH CHECK`.)

**Impact:** Booking-integrity tampering: out-of-hours / off-availability self-bookings, faking session status, editing a coach's schedule rows. The double-booking EXCLUDE constraint still blocked overlaps, limiting the blast radius.

**Fix:** Dropped the `"bookings update own"` policy (`supabase/migrations/20260620100000_restrict_member_booking_writes.sql`). The only legitimate member write — cancellation — now runs through the **service-role client after the existing ownership + 24-hour-policy check**, double-scoped to the member's own booking (`cancelMemberBooking`). Members keep `SELECT` ("bookings read own"); staff keep full control; the overlap constraint remains the hard backstop.

### SEC-3 — Coach Google-calendar columns readable by any signed-in member · Low

**What:** The 06-19 fix (`20260619120000`) revoked the **anon** role's table-wide `SELECT` on `staff` and re-granted only safe columns. But the `"public reads active staff"` RLS policy also applies to the **`authenticated`** role, which kept its default table-wide `SELECT`. RLS is row-level (can't hide columns), and members + staff share the one `authenticated` role — so any signed-in member could read every active coach's `google_calendar_email` and `google_calendar_connected_at`:
`GET /rest/v1/staff?select=google_calendar_email&is_active=eq.true` with their own JWT.

**Impact:** Low — discloses a coach's connected Google address (for the single-operator launch this is Jack's, already public in the site footer) and connection timestamp. No write/escalation path.

**Fix:** `supabase/migrations/20260620110000_staff_google_columns_authenticated.sql` revokes the authenticated role's table-wide `SELECT` and re-grants every column **except** the two Google ones (mirrors the anon-grant pattern). The coach's own profile now reads those two fields via the **service-role client** (`app/portal/profile/page.tsx`); they're written only by the service role (OAuth callback / disconnect), so no authenticated path needs them.
*Note:* `staff.auth_user_id` is deliberately left readable by `authenticated` — `requireStaff`/`isStaffUser`/`signIn` filter on it through that role, so revoking it breaks staff sign-in, and it's a non-exploitable opaque UUID (every RLS check keys off the server-verified JWT `auth.uid()`, never a client-supplied id).

### DOC-1 — Stale file-sharing note · Info (not changed)

`docs/BACKEND_SETUP.md` (Notes) still says shared files are "hidden in the UI" and "the `client-files` bucket … don't exist yet." The bucket, Storage RLS, and the staff-upload / client-download paths are now implemented (`20260609130000_client_files_storage.sql`, `lib/portal/actions.ts`, `lib/account/actions.ts`). Cosmetic only — flag for a doc refresh.

---

## 3. Reviewed and found solid (no action needed)

- **AuthZ / RLS:** Every table has RLS; member data (`clients`, `bookings`, `client_packages`, `assessments`, `documents`, `client_screenings`, `client_reports`) is scoped to the owner via `auth.uid()`; staff gated by `is_staff()` (SECURITY DEFINER). Reports only visible to members when `published` **and** `shared_with_client`.
- **Client privileged-column lock:** `clients` self-update has `WITH CHECK` **and** a `BEFORE UPDATE` trigger freezing `discount_tier`, `stripe_customer_id`, `email`, `marketing_consent`, `auth_user_id`, archive state (`20260604…`, extended `20260609…`).
- **Storage:** Private `client-files` bucket; clients can read only objects under their own `<client_id>/…` prefix; downloads via short-lived signed URLs.
- **Google OAuth:** CSRF `state` nonce verified; refresh tokens encrypted in Supabase Vault behind service-role-only RPCs; tokens never reach the browser.
- **Secrets:** `service_role` / Google secret are server-only (no `NEXT_PUBLIC_`); `.gitignore` is thorough; `.env.local` is ignored.
- **Headers:** Enforced CSP, HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false`.
- **Injection / XSS:** Parameterised Supabase queries throughout; **no** `dangerouslySetInnerHTML` / `eval` / `innerHTML` anywhere; static JS builds DOM from constants only.
- **Open redirect:** `next`-param validated in `signIn` and `/auth/callback` (rejects `//` and `/\`).
- **Uploads:** Allow-list MIME **and** magic-byte verification; 25 MB cap; randomised object paths.
- **Anti-abuse:** Honeypot + per-IP rate limit on the lead form and auth actions; 12-char password minimum; generic auth errors (no user enumeration).

## 4. Accepted residual risks (by design / low value — documented, not changed)

- **CSP `script-src 'unsafe-inline'`** — required for Next hydration + the shared static pages; nonce-based tightening is a future improvement.
- **In-memory rate limiter** is per-instance, not global (documented); pair with Supabase auth throttling, or move to Redis/Upstash if needed.
- **`x-forwarded-for`** first-hop trust — fine behind Vercel; a self-hosted proxy could let a client rotate the rate-limit key.
- **Multi-coach authz** — any active staff can act on any coach's bookings/clients; correct for a single operator, revisit when a 2nd coach is added (`MULTI-COACH:` markers in code).
- **`articles` "members-only" = any signed-in user** — by design.
- **`staff.auth_user_id` visible to authenticated** — non-exploitable UUID (see SEC-3 note).

## 5. Files changed

```
lib/auth/guards.ts                         + requireActiveClient()
lib/account/actions.ts                     use requireActiveClient; cancel via service-role + double-scope
lib/screening/actions.ts                   use requireActiveClient
app/portal/profile/page.tsx                read coach Google fields via service-role client
supabase/migrations/20260620100000_restrict_member_booking_writes.sql      (new) drop "bookings update own"
supabase/migrations/20260620110000_staff_google_columns_authenticated.sql  (new) revoke 2 staff cols from authenticated
```

## 6. Verification — ACTION REQUIRED

> The sandbox shell was unavailable for this session, so the automated suite and the **live Supabase smoke tests could not be executed**. Code edits were verified by manual review (imports, types, and data-flow are consistent), but please run the following before deploy. Nothing here is applied yet — the migrations are not pushed and the app is not rebuilt.

**Build & types**
```bash
npm install
npm run typecheck      # expect: no errors
npm run lint           # expect: no errors
npm run build          # expect: success
```

**Apply migrations**
```bash
supabase db push       # applies 20260620100000 + 20260620110000 in order
```

**Security smoke tests (use a real member JWT hitting Supabase directly, NOT the UI)**
- SEC-2: a member `UPDATE` on their own booking (`supabase.from('bookings').update({status:'confirmed'}).eq('id', myBookingId)`) is now **rejected** (no policy).
- SEC-2: cancelling a session in the UI still works and applies the 24-hour status correctly.
- SEC-3: a member `GET /rest/v1/staff?select=google_calendar_email` returns an **error / no column**; `select=id,display_name,title,bio` still works; the **staff** profile page still shows the connected Google address.
- SEC-1: archive a test member → they can still sign in but every member action (book, cancel, profile save, screening, file download) redirects to the inactive notice instead of executing.
- Regression: member can still book a valid slot, see their bookings, and download only their own files; staff portal + booking coach-picker still load.
```
