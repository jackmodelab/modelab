import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase/server';
import { hasCompletedScreening } from '@/lib/screening/queries';

/**
 * Lightweight, derived notifications.
 *
 * There is no notifications table — everything here is computed live from data
 * the app already stores (new clients, screenings, upcoming sessions, shared
 * files), so the panel is useful from day one without new schema.
 *
 * READ STATE: the "red dot" must clear once the user has looked, otherwise it's
 * permanently lit (an active studio always has a recent client / upcoming
 * session / shared file). We track a per-browser "last seen" timestamp in a
 * cookie (set by markNotificationsSeen when the Profile page — where the panel
 * lives — is opened). `unseen` counts only items that arrived AFTER that time,
 * and drives the dot; `items` still lists everything current for the panel.
 *
 * Standing reminders (screening nudge, upcoming session, sessions-soon) carry no
 * `at`, so they show in the panel but never re-light the dot on their own — they
 * have their own prominent surfaces (the screening banner, the calendar).
 */
export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  href?: string;
  /** When this item became "new" (ISO). Omitted for standing reminders. */
  at?: string;
};

export type Notifications = {
  items: NotificationItem[];
  /** Total current items (drives the panel's count badge). */
  count: number;
  /** Items newer than the last-seen marker (drives the unread dot). */
  unseen: number;
};

const DAY = 24 * 60 * 60 * 1000;

/** Cookie holding the ISO time the user last opened their notifications. */
export const NOTIF_SEEN_COOKIE = 'notif_seen_at';

/** Epoch when no marker is set yet → everything counts as unseen. */
const NEVER = '1970-01-01T00:00:00.000Z';

async function lastSeenMs(): Promise<number> {
  const store = await cookies();
  const raw = store.get(NOTIF_SEEN_COOKIE)?.value;
  const ms = new Date(raw ?? NEVER).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Count items that became new after the last-seen marker. */
function countUnseen(items: NotificationItem[], seenMs: number): number {
  return items.filter((i) => i.at && new Date(i.at).getTime() > seenMs).length;
}

/** Staff dashboard notifications: new clients, recent screenings, soon sessions. */
export async function getStaffNotifications(): Promise<Notifications> {
  const supabase = await createSupabaseServer();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const soon = new Date(now + DAY).toISOString();
  const nowIso = new Date(now).toISOString();

  const [{ data: newClients }, { data: screenings }, { data: soonBookings }, seenMs] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, email, created_at')
      .is('archived_at', null)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_screenings')
      .select('id, client_id, created_at')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select('id, starts_at, status')
      .gte('starts_at', nowIso)
      .lte('starts_at', soon),
    lastSeenMs(),
  ]);

  const items: NotificationItem[] = [];

  const clientRows = (newClients ?? []) as { id: string; full_name: string | null; email: string; created_at: string }[];
  for (const c of clientRows.slice(0, 5)) {
    items.push({
      id: `client-${c.id}`,
      title: 'New client',
      detail: c.full_name || c.email,
      href: `/portal/clients/${c.id}`,
      at: c.created_at,
    });
  }

  const screeningRows = (screenings ?? []) as { id: string; created_at: string }[];
  if (screeningRows.length > 0) {
    items.push({
      id: 'screenings',
      title: 'Pre-screening submitted',
      detail: `${screeningRows.length} new this week`,
      href: '/portal/clients',
      at: screeningRows[0].created_at, // most recent (rows are desc)
    });
  }

  const soonRows = (soonBookings ?? []) as { id: string; status: string | null }[];
  const liveSoon = soonRows.filter(
    (b) => !b.status?.startsWith('cancelled') && b.status !== 'no_show',
  );
  if (liveSoon.length > 0) {
    items.push({
      id: 'sessions-soon',
      title: 'Sessions in the next 24 hours',
      detail: `${liveSoon.length} scheduled`,
      href: '/portal/schedule',
      // standing reminder — no `at`, so it never re-lights the dot on its own.
    });
  }

  return { items, count: items.length, unseen: countUnseen(items, seenMs) };
}

/** Member notifications: next session, screening nudge, newly shared files. */
export async function getMemberNotifications(clientId: string): Promise<Notifications> {
  const supabase = await createSupabaseServer();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const twoWeeksAgo = new Date(now - 14 * DAY).toISOString();

  const [{ data: nextBooking }, { data: docs }, screeningDone, seenMs] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, starts_at, status')
      .eq('client_id', clientId)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(5),
    supabase
      .from('documents')
      .select('id, title, created_at')
      .eq('client_id', clientId)
      .gte('created_at', twoWeeksAgo)
      .order('created_at', { ascending: false }),
    hasCompletedScreening(clientId),
    lastSeenMs(),
  ]);

  const items: NotificationItem[] = [];

  if (!screeningDone) {
    items.push({
      id: 'screening',
      title: 'Complete your pre-screening',
      detail: 'Required before your first session',
      href: '/account/screening',
      // standing reminder — also shown as a banner on every account page.
    });
  }

  const upcoming = ((nextBooking ?? []) as { id: string; starts_at: string; status: string | null }[]).filter(
    (b) => !b.status?.startsWith('cancelled') && b.status !== 'no_show',
  );
  if (upcoming[0]) {
    items.push({
      id: `booking-${upcoming[0].id}`,
      title: 'Upcoming session',
      detail: 'You have a session booked',
      href: '/account/bookings',
      // standing reminder — no `at`.
    });
  }

  const docRows = (docs ?? []) as { id: string; title: string; created_at: string }[];
  for (const d of docRows.slice(0, 5)) {
    items.push({
      id: `doc-${d.id}`,
      title: 'New file shared with you',
      detail: d.title,
      href: '/account/files',
      at: d.created_at,
    });
  }

  return { items, count: items.length, unseen: countUnseen(items, seenMs) };
}
