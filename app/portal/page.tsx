import Link from 'next/link';
import { format, parseISO, startOfDay, endOfDay, addDays, isSameDay } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatTime, bookingStatusLabel } from '@/lib/format';
import type { BookingRow, ClientRow, StaffAvailabilityRow } from '@/types/database';
import { Icon } from '@/components/portal/icons';

export const metadata = { title: 'Staff portal — MODE Lab' };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function PortalPage() {
  const { staff } = await requireStaff();
  const supabase = await createSupabaseServer();

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekAhead = addDays(now, 7).toISOString();
  const sevenDaysBack = addDays(now, -7).toISOString();

  const [{ data: clients }, { data: weekBookings }, { data: avail }, { data: services }, { data: locations }] =
    await Promise.all([
      supabase.from('clients').select('*').order('full_name', { ascending: true }),
      supabase
        .from('bookings')
        .select('*')
        .gte('starts_at', todayStart.toISOString())
        .lte('starts_at', weekAhead)
        .order('starts_at', { ascending: true }),
      supabase.from('staff_availability').select('*').eq('staff_id', staff.id).order('weekday', { ascending: true }),
      supabase.from('services').select('id,name'),
      supabase.from('locations').select('id,name,suburb'),
    ]);

  const allClients = (clients ?? []) as ClientRow[];
  // Pending requests live on the Requests page, not the confirmed dashboard.
  const week = ((weekBookings ?? []) as BookingRow[]).filter((b) => b.status !== 'pending');
  const today = week.filter((b) => isSameDay(parseISO(b.starts_at), now));
  const upcomingWeek = week.filter((b) => parseISO(b.starts_at) > todayEnd);
  const availability = (avail ?? []) as StaffAvailabilityRow[];
  const newClients7d = allClients.filter((c) => c.created_at >= sevenDaysBack).length;

  const clientName = new Map(allClients.map((c) => [c.id, c.full_name || c.email]));
  const serviceName = new Map(((services ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const locationName = new Map(
    ((locations ?? []) as { id: string; name: string; suburb: string | null }[]).map((l) => [l.id, l.suburb || l.name]),
  );

  const firstName = staff.display_name?.split(' ')[0];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · {format(now, 'EEE dd MMM')}</p>
          <h1>{firstName ? `${firstName}'s today.` : 'Today.'}</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--ghost" href="/portal/availability">
            Availability
          </Link>
          <Link className="btn" href="/portal/bookings/new">
            <Icon.plus /> New booking
          </Link>
        </div>
      </header>

      <div className="stat-strip">
        <div className="stat-card">
          <div className="k">Sessions today</div>
          <div className="v">{today.length}</div>
          <div className="sub">{today.filter((b) => b.status === 'confirmed').length} confirmed</div>
        </div>
        <div className="stat-card">
          <div className="k">Upcoming this week</div>
          <div className="v">{upcomingWeek.length}</div>
          <div className="sub">Through {format(addDays(now, 7), 'EEE dd MMM')}</div>
        </div>
        <div className="stat-card">
          <div className="k">New clients · 7d</div>
          <div className="v">{newClients7d}</div>
          <div className="sub">{allClients.length} total</div>
        </div>
      </div>

      <div className="ov-grid">
        {/* Today's bookings (timeline) */}
        <section className="surface">
          <div className="surface-head">
            <h2>
              Today
              <span className="count">{today.length} bookings</span>
            </h2>
            <Link className="link-arrow" href="/portal/schedule">
              Calendar <Icon.arrowR />
            </Link>
          </div>
          <div className="timeline">
            {today.length === 0 ? (
              <div className="next-empty">
                <h2>Nothing booked today.</h2>
                <p>Your day is clear. Create a session to fill it in.</p>
                <Link className="btn" href="/portal/bookings/new">
                  <Icon.plus /> New booking
                </Link>
              </div>
            ) : (
              today.map((b) => {
                const dt = parseISO(b.starts_at);
                const end = parseISO(b.ends_at);
                const past = end < now;
                return (
                  <div className={`timeline-row ${past ? 'is-past' : ''}`} key={b.id}>
                    <div className="timeline-time">
                      {formatTime(dt).toLowerCase()}
                      <span className="end">→ {formatTime(end).toLowerCase()}</span>
                    </div>
                    <div className="timeline-main">
                      <div className="timeline-name">{clientName.get(b.client_id) ?? 'Client'}</div>
                      <div className="timeline-meta">
                        {serviceName.get(b.service_id) ?? 'Session'} · {locationName.get(b.location_id) ?? '—'}
                      </div>
                    </div>
                    <span className={`status-dot ${b.status === 'completed' ? 'is-done' : b.status?.startsWith('cancelled') ? 'is-cancelled' : ''}`}>
                      {bookingStatusLabel(b.status)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Your availability */}
        <section className="surface">
          <div className="surface-head">
            <h2>
              Your availability
              <span className="count">{availability.filter((a) => a.is_active).length} open</span>
            </h2>
            <Link className="link-arrow" href="/portal/availability">
              Edit <Icon.arrowR />
            </Link>
          </div>
          <div className="surface-body">
            {availability.length === 0 ? (
              <div className="next-empty">
                <h2>No availability set.</h2>
                <p>Add weekly blocks so clients know when you’re open.</p>
                <Link className="btn" href="/portal/availability">
                  Set availability <Icon.arrowR />
                </Link>
              </div>
            ) : (
              availability.slice(0, 6).map((a) => (
                <div className="row-item" key={a.id}>
                  <div className="ri-main">
                    <div className="ri-title">{WEEKDAYS[a.weekday]}</div>
                    <div className="ri-sub">
                      {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}
                      {a.location_id ? ` · ${locationName.get(a.location_id) ?? 'Location'}` : ''}
                    </div>
                  </div>
                  <span className={`pill ${a.is_active ? 'pill--ok' : ''}`}>{a.is_active ? 'Open' : 'Off'}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Upcoming this week */}
      <section className="surface" style={{ marginTop: 20 }}>
        <div className="surface-head">
          <h2>
            Upcoming
            <span className="count">{upcomingWeek.length} this week</span>
          </h2>
          <Link className="link-arrow" href="/portal/schedule">
            Open calendar <Icon.arrowR />
          </Link>
        </div>
        <div className="surface-body">
          {upcomingWeek.length === 0 ? (
            <p className="empty">No upcoming bookings this week.</p>
          ) : (
            upcomingWeek.slice(0, 8).map((b) => {
              const dt = parseISO(b.starts_at);
              return (
                <Link className="row-item is-clickable" key={b.id} href={`/portal/bookings/${b.id}/edit`}>
                  <div className="ri-main">
                    <div className="ri-title">{clientName.get(b.client_id) ?? 'Client'}</div>
                    <div className="ri-sub">
                      {format(dt, 'EEE dd MMM · h:mma').replace(/AM|PM/i, (m) => m.toLowerCase())} ·{' '}
                      {serviceName.get(b.service_id) ?? 'Session'} · {locationName.get(b.location_id) ?? '—'}
                    </div>
                  </div>
                  <div className="ri-actions">
                    <span className="pill">{bookingStatusLabel(b.status)}</span>
                    <Icon.chevronR className="ri-chevron" />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <div className="ov-grid" style={{ marginTop: 20 }}>
        {/* Clients */}
        <section className="surface">
          <div className="surface-head">
            <h2>
              Clients
              <span className="count">{allClients.length} total</span>
            </h2>
            <Link className="link-arrow" href="/portal/clients">
              View all <Icon.arrowR />
            </Link>
          </div>
          <div className="surface-body">
            {allClients.length === 0 ? (
              <p className="empty">No clients yet.</p>
            ) : (
              allClients.slice(0, 6).map((c) => (
                <div className="row-item" key={c.id}>
                  <div className="ri-main">
                    <div className="ri-title">{c.full_name || '—'}</div>
                    <div className="ri-sub">
                      {c.email}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </div>
                  </div>
                  <span className="pill">
                    {c.discount_tier === 'standard' ? 'Standard' : c.discount_tier === 'student_senior' ? 'Student' : 'F&F'}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </>
  );
}
