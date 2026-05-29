# Employee Pages — Design Handoff

**Product:** MODE Lab staff portal
**Scope:** The four authenticated employee screens under `/portal`
**Stack:** Next.js 14 (App Router, server components), Supabase (Auth + Postgres/RLS), brand CSS design system (no Tailwind)
**Status:** Built and working against live Supabase. This document describes what exists today so design can review, refine, and extend it.

---

## 1. Audience & access

These pages are for **MODE Lab trainers / exercise scientists** ("staff"), not clients.

- Every `/portal/*` route calls `requireStaff()` ([lib/auth/guards.ts:38](../lib/auth/guards.ts#L38)).
  - Not signed in → redirect to `/login?next=/portal`.
  - Signed in but not an active staff member → redirect to `/account` (the members area).
- The shell is rendered once in [app/portal/layout.tsx](../app/portal/layout.tsx): a sticky `AppHeader` with a `Staff` role pill + nav, and a centered `.container` main column.
- Top nav (`Overview · Calendar · Availability · Clients`). "Clients" is an in-page anchor (`/portal#clients`) on the Overview page, not a separate route.

---

## 2. Design system (what these pages inherit)

All styling comes from `styles/brand.css` (tokens + marketing components) plus the app-only block in [app/globals.css](../app/globals.css). **Monochrome Clinical** — no color beyond ink, paper, and slate; hierarchy comes from weight, mono-type labels, and 1px hairlines.

### Color tokens
| Token | Value | Use |
|---|---|---|
| `--lab-white` | `#FBFBFA` | Page background |
| `--pure-white` | white | Cards / panels / stat tiles |
| `--engineered-black` | `#0E0F11` | Headings, primary marks, "active" tags & chips |
| `--data-slate` | `#494F57` | Body / secondary text |
| `--slate-soft` / `--slate-faint` | — | Mono labels / muted & disabled states |
| `--line` | `rgba(14,15,17,0.10)` | Hairline borders, cell grid |
| `--line-strong` | `rgba(14,15,17,0.22)` | Inputs, buttons, stronger dividers |

### Type
- **Inter** (`--font-sans`) for prose and titles; **Roboto Mono** (`--font-mono`) for all labels, stats, timestamps, tags, nav.
- Fluid scale `--step--1 … --step-5`. Page H1 on these screens uses `--step-3` (`2–3rem`).
- The mono "kicker / greet" label pattern (uppercase, `0.16em` tracking, `--slate-soft`) is the signature element — it sits above every page title and inside every stat tile.

### Shape & motion
- Radius `--radius: 3px` everywhere (intentionally tight/clinical).
- Borders over shadows. The one shadow is the card hover lift on marketing cards, not used in portal.
- Transitions ~`.3s var(--ease)` on hover for links/buttons; `.2s` background on calendar cells.

### Reusable primitives (already in CSS)
- `.dash-head` — page header row: left = `.greet` kicker + `h1`; right = a tag/link/button, bottom-aligned.
- `.stat-row` + `.stat` (`.v` value / `.k` mono label) — 4-up stat tiles, 2-up under 760px.
- `.panel` / `.panel-head` (`h2` + `.count`) / `.panel-body` — the workhorse container.
- `.row-item` (`.ri-main` → `.ri-title` + `.ri-sub`, `.ri-meta`) — list row used in every panel.
- `.tag`, `.tag--ok` (filled black), `.tag--muted` — status chips.
- `.btn`, `.btn-mini`, `.btn-mini--neutral`, `.text-link` (animated arrow) — actions.
- `.field` (label + input/select), `.empty` (centered empty state).

---

## 3. The pages

### 3.1 Overview — `/portal` ([source](../app/portal/page.tsx))

The trainer's home dashboard. Read-only summary that links out to the action pages.

**Layout, top to bottom**
1. `.dash-head` — kicker `MODE LAB / STAFF`, H1 `"{First}'s portal."` (falls back to `"Staff portal."`), and a `.tag--ok` showing the staff member's `title` (default "Exercise Scientist").
2. `.stat-row` — four tiles: **Total clients**, **Upcoming sessions**, **Availability blocks**, **Recent files**.
3. `.panel-grid` (1.5fr / 1fr, collapses to 1 column ≤900px):
   - **Upcoming schedule** — next up to 12 future bookings; each row: client name / `service · date-time · location`; `.tag--ok` status. Header link → Calendar.
   - **Your availability** — this staff member's weekly blocks (weekday + `HH:MM–HH:MM`, Open/Off tag). Header link + footer note → Availability page.
4. **Clients** panel (full width, anchor `#clients`) — every client: name, `email · phone`, and a discount-tier tag (`Standard` / `Student/Senior` / `F&F`).
5. **Recently shared files** panel — up to 6 documents: title, `client · date`, file-type tag.

**States:** each panel has an `.empty` fallback ("No upcoming bookings.", "No availability set.", "No clients yet.", "No files shared yet.").

**Design notes / open questions**
- Stat tiles and panels are read-only; the only actions are the "→" links. Consider whether "Recently shared files" rows should be clickable (currently inert).
- Client list is unpaginated and unsorted-for-scanning (newest first). At scale this panel needs search/pagination — flag for design.

---

### 3.2 Calendar — `/portal/schedule` ([source](../app/portal/schedule/page.tsx), client component [components/booking-calendar.tsx](../components/booking-calendar.tsx))

Month grid + selected-day detail. Loads bookings from −60 to +180 days.

**Layout** — `.cal-layout` two columns (1.7fr calendar / 1fr day panel; stacks ≤940px).
- `.dash-head`: kicker `MODE LAB / STAFF · SCHEDULE`, H1 "Your calendar.", right side = `Availability →` link + **New booking** `.btn`.
- **Calendar** (`.cal`): toolbar with `MMMM yyyy` + prev / **Today** / next buttons (38px square, invert on hover). Week starts **Monday**. 6×7 fixed grid (42 cells).
  - Each cell: day number (today = filled black circle); up to **3 booking chips**; `+N more` overflow.
  - Outside-month cells greyed; selected cell gets a 2px inset black ring; hover tints `--lab-white`.
- **Day panel** (`.panel.day-panel`): header `EEE d MMM` + session count; rows show client / `time–time · service · location` + status tag + **Edit** mini-button.

**Chip / status semantics**
- Default (confirmed/rescheduled): **filled black** chip.
- `completed` → outlined chip, "Done".
- `cancelled_*` or `no_show` → dashed outline, **strikethrough**, "Cancelled".

**Responsive:** ≤620px, chips collapse into **7px dots** (filled = active, outlined = cancelled) so the month stays legible on mobile.

**Design notes / open questions**
- No week/day view, no drag-to-reschedule, no time-of-day rows — it's a month overview that defers detail to the side panel. Decide if a week view is needed.
- Chip label is `h:mm` + client first name only. Confirm that's the right density at 3-per-cell.
- "Today" resets both the visible month and the selected day.

---

### 3.3 Availability — `/portal/availability` ([source](../app/portal/availability/page.tsx))

Editor for the trainer's **recurring weekly** availability windows (these will feed the future client booking flow).

**Layout**
- `.dash-head`: kicker `MODE LAB / STAFF · AVAILABILITY`, H1 "Your weekly availability.", right = `View calendar →`. A `.lede` sentence explains the purpose.
- **Add-block form** (`.avail-form`, a 5-column grid → 2-col ≤760px): Day select (Mon→Sun order), From / To time inputs (`06:00` / `12:00` defaults), Location select (`Any location` + real locations), **Add block →** button.
- **Recurring blocks** panel: grouped by day with a mono `.avail-day-label` heading; each block row = `HH:MM – HH:MM` / location, an Open/Off tag, and two inline actions: **Turn on/off** (neutral) and **Remove** (red on hover).

**States:** `.empty` → "No availability set yet. Add your first block above."

**Behavior** (server actions in [lib/portal/actions.ts](../lib/portal/actions.ts)): `addAvailability` (rejects if end ≤ start), `toggleAvailability`, `deleteAvailability`. All revalidate the page. **No confirm dialog on Remove** and no inline validation messaging — failures just silently no-op. Flag both for design.

**Design notes / open questions**
- "Off" blocks remain listed but greyed via `tag--muted` — confirm that's clearer than hiding them.
- No overlap detection between blocks; no per-block edit (only toggle/remove + re-add).

---

### 3.4 Booking create / edit — `/portal/bookings/new` & `/portal/bookings/[id]/edit`
([new](../app/portal/bookings/new/page.tsx) · [edit](../app/portal/bookings/[id]/edit/page.tsx) · form [components/booking-form.tsx](../components/booking-form.tsx))

One shared `BookingForm`, mode = `create | edit`. Single-column, `max-width 560px`.

**Fields**
- **Client** — full-width select (placeholder "Select a client…").
- **Service** + **Location** — 2-up row of selects.
- **Starts** — `datetime-local`. End time is computed server-side from the service's `duration_minutes` (default 45 min); there is **no end-time field**.
- **Status** — *edit mode only*: Confirmed / Completed / Rescheduled / No-show / Cancelled.
- Actions: primary `.btn` ("Create booking" / "Save changes") + `Cancel` text-link → Calendar.

**Headers** match the family: kicker `… · NEW BOOKING` / `… · EDIT BOOKING`, H1 "Create a booking." / "Edit booking.", `← Calendar` back-link.

**Behavior:** server actions `createBooking` / `updateBooking`. On missing fields, create redirects to `…/new?error=1` — but **there is no UI that renders that error** today. Flag: design needs an error/validation state for the form.

**Design notes / open questions**
- Status list in the form (`cancelled_24hr_plus` only) is a simplified subset of the 6 DB statuses; the cancellation 24hr-plus/under distinction is collapsed. Confirm intended.
- No double-booking / availability-conflict warning at create time.

---

## 4. Cross-cutting interaction & a11y notes

- **Forms are progressive-enhancement** (native `<form action={serverAction}>`), so they work without JS. Keep that constraint in mind for any new interactive design — heavy client-only widgets break the auth-cookie round-trip (see the comment in `booking-form.tsx`).
- **Focus:** global `:focus-visible` = 2px solid black outline. Calendar nav buttons have `aria-label`s. Calendar cells are clickable `<div>`s — **not keyboard-focusable today** (a11y gap to flag).
- **No toasts / loading / disabled-while-submitting states** anywhere — submits redirect on success and silently no-op on failure. This is the biggest feedback gap across all four pages.
- **Empty states** exist but are plain text; no illustration or primary CTA (except availability's "Add your first block above").

---

## 5. What's NOT built yet (relevant to design)

Per project notes, still TODO and likely to touch these pages: Stripe checkout, the client-facing booking flow that consumes availability, Google Calendar sync, and portal write-actions for file upload / report builder. The Overview's "Recently shared files" panel anticipates that file feature.

## 6. Quick reference — where things live

| Thing | File |
|---|---|
| Portal shell + nav | [app/portal/layout.tsx](../app/portal/layout.tsx) |
| Overview dashboard | [app/portal/page.tsx](../app/portal/page.tsx) |
| Calendar page / component | [app/portal/schedule/page.tsx](../app/portal/schedule/page.tsx) · [components/booking-calendar.tsx](../components/booking-calendar.tsx) |
| Availability editor | [app/portal/availability/page.tsx](../app/portal/availability/page.tsx) |
| Booking form (new/edit) | [components/booking-form.tsx](../components/booking-form.tsx) |
| Server actions (write) | [lib/portal/actions.ts](../lib/portal/actions.ts) |
| Auth guard | [lib/auth/guards.ts](../lib/auth/guards.ts) |
| App-only styles | [app/globals.css](../app/globals.css) |
| Brand tokens / primitives | [styles/brand.css](../styles/brand.css) |
| Header / sign-out | [components/app-header.tsx](../components/app-header.tsx) |
