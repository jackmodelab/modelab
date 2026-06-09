import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { BookingCalendar, type CalBooking, type CalBlock, type WorkingMap } from '@/components/booking-calendar';
import type { BookingRow, ClientRow, StaffAvailabilityRow, StaffBlockRow } from '@/types/database';

export const metadata = { title: 'Schedule — MODE Lab' };

/** "HH:MM[:SS]" → decimal hours. */
function toDecHour(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
}

export default async function SchedulePage() {
  const { staff } = await requireStaff();
  const supabase = await createSupabaseServer();

  // Window: 60 days back → 180 days ahead (plenty for month navigation).
  const from = new Date();
  from.setDate(from.getDate() - 60);
  const to = new Date();
  to.setDate(to.getDate() + 180);

  const [{ data: bookings }, { data: clients }, { data: services }, { data: locations }, { data: avail }, { data: blocks }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .neq('status', 'pending') // pending requests live on /portal/requests
        .gte('starts_at', from.toISOString())
        .lte('starts_at', to.toISOString())
        .order('starts_at', { ascending: true }),
      supabase.from('clients').select('id,full_name,email').order('full_name', { ascending: true }),
      supabase.from('services').select('id,name,duration_minutes,is_active').order('sort_order', { ascending: true }),
      supabase.from('locations').select('id,name,suburb').order('name', { ascending: true }),
      supabase.from('staff_availability').select('*').eq('staff_id', staff.id).eq('is_active', true),
      supabase
        .from('staff_blocks')
        .select('*')
        .eq('staff_id', staff.id)
        .gte('starts_at', from.toISOString())
        .lte('starts_at', to.toISOString()),
    ]);

  const rows = (bookings ?? []) as BookingRow[];
  const clientRows = (clients ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email'>[];
  const serviceRows = (services ?? []) as { id: string; name: string; duration_minutes: number | null; is_active: boolean }[];
  const locationRows = (locations ?? []) as { id: string; name: string; suburb: string | null }[];
  const clientName = new Map(clientRows.map((c) => [c.id, c.full_name || c.email]));
  const serviceName = new Map(serviceRows.map((s) => [s.id, s.name]));
  const locationName = new Map(locationRows.map((l) => [l.id, l.suburb || l.name]));

  const calBookings: CalBooking[] = rows.map((b) => ({
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    clientName: clientName.get(b.client_id) ?? 'Client',
    serviceName: serviceName.get(b.service_id) ?? 'Session',
    locationName: locationName.get(b.location_id) ?? '—',
    status: b.status,
    notes: b.notes,
  }));

  // Merge the signed-in coach's open availability into per-weekday intervals so
  // the week grid can shade non-working hours.
  const working: WorkingMap = {};
  for (const a of (avail ?? []) as StaffAvailabilityRow[]) {
    (working[a.weekday] ??= []).push({ start: toDecHour(a.start_time), end: toDecHour(a.end_time) });
  }

  const calBlocks: CalBlock[] = ((blocks ?? []) as StaffBlockRow[]).map((b) => ({
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    reason: b.reason,
  }));

  // Option lists for the quick-book popup.
  const clientOpts = clientRows.map((c) => ({ id: c.id, name: c.full_name || c.email }));
  const serviceOpts = serviceRows.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }));
  const locationOpts = locationRows.map((l) => ({ id: l.id, name: l.suburb || l.name }));
  const serviceDurations = Object.fromEntries(serviceRows.map((s) => [s.id, s.duration_minutes ?? 45]));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Calendar</p>
          <h1>Your calendar.</h1>
        </div>
        <div className="page-head-actions">
          <a className="btn btn--ghost" href="/portal/availability">
            Availability
          </a>
          <a className="btn" href="/portal/bookings/new">
            New booking
          </a>
        </div>
      </header>

      <BookingCalendar
        bookings={calBookings}
        working={working}
        blocks={calBlocks}
        clients={clientOpts}
        services={serviceOpts}
        locations={locationOpts}
        serviceDurations={serviceDurations}
      />
    </>
  );
}
