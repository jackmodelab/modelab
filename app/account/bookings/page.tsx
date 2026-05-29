import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireClient } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatTime, bookingStatusLabel } from '@/lib/format';
import { cancelMemberBooking } from '@/lib/account/actions';
import type { BookingRow } from '@/types/database';
import { Icon } from '@/components/portal/icons';

export const metadata = { title: 'My bookings — MODE Lab' };

type Tab = 'upcoming' | 'past';

export default async function BookingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { client } = await requireClient();
  const tab: Tab = searchParams.tab === 'past' ? 'past' : 'upcoming';

  if (!client) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="kicker">MODE Lab · Member</p>
            <h1>My bookings.</h1>
          </div>
        </header>
        <p className="empty">Setting up your profile.</p>
      </>
    );
  }

  const supabase = createSupabaseServer();
  const now = new Date().toISOString();

  const [{ data: bookings }, { data: services }, { data: locations }, { data: staff }] = await Promise.all([
    supabase.from('bookings').select('*').eq('client_id', client.id).order('starts_at', { ascending: true }),
    supabase.from('services').select('id,name'),
    supabase.from('locations').select('id,name,suburb'),
    supabase.from('staff').select('id,display_name'),
  ]);

  const serviceName = new Map(((services ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const locationName = new Map(((locations ?? []) as { id: string; name: string; suburb: string | null }[]).map((l) => [l.id, l.suburb || l.name]));
  const staffName = new Map(((staff ?? []) as { id: string; display_name: string }[]).map((s) => [s.id, s.display_name]));

  const all = (bookings ?? []) as BookingRow[];
  const upcoming = all.filter((b) => b.starts_at >= now && !b.status?.startsWith('cancelled') && b.status !== 'no_show');
  const past = all.filter((b) => b.starts_at < now || b.status === 'completed' || b.status?.startsWith('cancelled') || b.status === 'no_show').reverse();

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Member</p>
          <h1>My bookings.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn" href="/account/book">
            <Icon.plus /> Book a session
          </Link>
        </div>
      </header>

      <div className="tabs" style={{ marginBottom: 18 }}>
        <Link className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} href="/account/bookings">
          Upcoming · {upcoming.length}
        </Link>
        <Link className={`tab-btn ${tab === 'past' ? 'active' : ''}`} href="/account/bookings?tab=past">
          Past · {past.length}
        </Link>
      </div>

      <section className="surface">
        <div className="surface-body">
          {list.length === 0 ? (
            <p className="empty">{tab === 'upcoming' ? 'No upcoming sessions.' : 'No past sessions yet.'}</p>
          ) : (
            list.map((b) => {
              const start = parseISO(b.starts_at);
              const end = parseISO(b.ends_at);
              const past = b.starts_at < now;
              const cancelled = b.status?.startsWith('cancelled') || b.status === 'no_show';
              return (
                <div className={`bk-row ${past ? 'is-past' : ''}`} key={b.id}>
                  <div className="bk-day">
                    <div className="mon">{format(start, 'MMM')}</div>
                    <div className="num">{format(start, 'd')}</div>
                    <div className="dow">{format(start, 'EEE')}</div>
                  </div>
                  <div className="bk-main">
                    <div className="bk-title">{serviceName.get(b.service_id) ?? 'Session'}</div>
                    <div className="bk-meta">
                      <span>
                        {formatTime(start).toLowerCase()} → {formatTime(end).toLowerCase()}
                      </span>
                      <span className="dot">·</span>
                      <span>{staffName.get(b.staff_id ?? '') ?? 'Coach'}</span>
                      <span className="dot">·</span>
                      <span>{locationName.get(b.location_id) ?? '—'}</span>
                      <span className="dot">·</span>
                      <span
                        className={`status-dot ${b.status === 'completed' ? 'is-done' : cancelled ? 'is-cancelled' : ''}`}
                      >
                        {bookingStatusLabel(b.status)}
                      </span>
                    </div>
                  </div>
                  {tab === 'upcoming' && !cancelled && (
                    <div className="bk-actions">
                      <Link className="btn btn--mini btn--ghost" href="/account/book">
                        Reschedule
                      </Link>
                      <form action={cancelMemberBooking} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="btn btn--mini btn--danger" type="submit">
                          Cancel
                        </button>
                      </form>
                    </div>
                  )}
                  {tab === 'past' && (
                    <div className="bk-actions">
                      <span className="pill">{b.status === 'completed' ? 'Done' : bookingStatusLabel(b.status)}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <p style={{ marginTop: 20, color: 'var(--slate)', fontSize: 12, lineHeight: 1.55, maxWidth: '60ch' }}>
        Cancel <strong>more than 24 hours</strong> ahead and your credit returns to your package. Within 24 hours,
        the session is consumed (late cancellation).
      </p>
    </>
  );
}
