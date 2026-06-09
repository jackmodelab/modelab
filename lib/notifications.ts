import { createSupabaseServer } from '@/lib/supabase/server';
import { hasCompletedScreening } from '@/lib/screening/queries';

/**
 * Lightweight, derived notifications.
 *
 * There is no read-state table — the "red dot" simply means there is at least
 * one current notification. Everything here is computed live from data the app
 * already stores (new clients, screenings, upcoming sessions, shared files), so
 * the panel is useful from day one without new schema.
 */
export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

export type Notifications = {
  items: NotificationItem[];
  count: number;
};

const DAY = 24 * 60 * 60 * 1000;

/** Staff dashboard notifications: new clients, recent screenings, soon sessions. */
export async function getStaffNotifications(): Promise<Notifications> {
  const supabase = await createSupabaseServer();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const soon = new Date(now + DAY).toISOString();
  const nowIso = new Date(now).toISOString();

  const [{ data: newClients }, { data: screenings }, { data: soonBookings }] = await Promise.all([
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
  ]);

  const items: NotificationItem[] = [];

  const clientRows = (newClients ?? []) as { id: string; full_name: string | null; email: string }[];
  for (const c of clientRows.slice(0, 5)) {
    items.push({
      id: `client-${c.id}`,
      title: 'New client',
      detail: c.full_name || c.email,
      href: `/portal/clients/${c.id}`,
    });
  }

  const screeningRows = (screenings ?? []) as { id: string }[];
  if (screeningRows.length > 0) {
    items.push({
      id: 'screenings',
      title: 'Pre-screening submitted',
      detail: `${screeningRows.length} new this week`,
      href: '/portal/clients',
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
    });
  }

  return { items, count: items.length };
}

/** Member notifications: next session, screening nudge, newly shared files. */
export async function getMemberNotifications(clientId: string): Promise<Notifications> {
  const supabase = await createSupabaseServer();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const twoWeeksAgo = new Date(now - 14 * DAY).toISOString();

  const [{ data: nextBooking }, { data: docs }, screeningDone] = await Promise.all([
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
  ]);

  const items: NotificationItem[] = [];

  if (!screeningDone) {
    items.push({
      id: 'screening',
      title: 'Complete your pre-screening',
      detail: 'Required before your first session',
      href: '/account/screening',
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
    });
  }

  const docRows = (docs ?? []) as { id: string; title: string }[];
  for (const d of docRows.slice(0, 5)) {
    items.push({
      id: `doc-${d.id}`,
      title: 'New file shared with you',
      detail: d.title,
      href: '/account/files',
    });
  }

  return { items, count: items.length };
}
