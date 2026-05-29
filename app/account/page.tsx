import Link from 'next/link';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { requireClient } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatTime, bookingStatusLabel } from '@/lib/format';
import type { BookingRow, ClientPackageRow, ArticleRow } from '@/types/database';
import { Icon } from '@/components/portal/icons';

export const metadata = { title: 'Your account — MODE Lab' };

export default async function AccountPage() {
  const { client } = await requireClient();

  // Provisioning state — no client row yet.
  if (!client) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="kicker">MODE Lab · Member</p>
            <h1>Welcome.</h1>
          </div>
        </header>
        <p className="empty">We&rsquo;re setting up your profile. Refresh in a moment, or contact us if this persists.</p>
      </>
    );
  }

  const supabase = createSupabaseServer();
  const now = new Date().toISOString();

  const [{ data: bookings }, { data: pkgs }, { data: articles }, { data: services }, { data: locations }, { data: packages }] =
    await Promise.all([
      supabase.from('bookings').select('*').eq('client_id', client.id).order('starts_at', { ascending: true }),
      supabase.from('client_packages').select('*').eq('client_id', client.id).eq('status', 'active'),
      supabase.from('articles').select('*').eq('published', true).order('published_at', { ascending: false }).limit(3),
      supabase.from('services').select('id,name'),
      supabase.from('locations').select('id,name,suburb'),
      supabase.from('packages').select('id,name'),
    ]);

  const serviceName = new Map(((services ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const locationName = new Map(((locations ?? []) as { id: string; name: string; suburb: string | null }[]).map((l) => [l.id, l.suburb || l.name]));
  const packageName = new Map(((packages ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const all = (bookings ?? []) as BookingRow[];
  const upcoming = all.filter((b) => b.starts_at >= now && (b.status === 'confirmed' || b.status === 'rescheduled'));
  const past = all.filter((b) => b.starts_at < now || b.status === 'completed').reverse();
  const next = upcoming[0];

  const activePkgs = (pkgs ?? []) as ClientPackageRow[];
  const reads = (articles ?? []) as ArticleRow[];

  const sessionsLeft = activePkgs.reduce((sum, p) => {
    const alloc = (p.sessions_remaining as Record<string, number>) || {};
    return sum + Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
  }, 0);

  const firstName = client.full_name?.split(' ')[0];
  const today = new Date();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">{format(today, 'EEEE, dd MMM yyyy')}</p>
          <h1>{firstName ? `Hi, ${firstName}.` : 'Welcome back.'}</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn" href="/account/book">
            <Icon.plus /> Book a session
          </Link>
        </div>
      </header>

      {/* Next session — dark card if upcoming, dashed empty state otherwise */}
      {next ? (
        <NextSessionCard
          booking={next}
          serviceName={serviceName.get(next.service_id) ?? 'Session'}
          locationName={locationName.get(next.location_id) ?? '—'}
        />
      ) : (
        <div className="next-empty">
          <h2>Find a time that works.</h2>
          <p>Pick a coach, location and time — we&rsquo;ll handle the rest.</p>
          <Link className="btn" href="/account/book">
            <Icon.plus /> Book a session
          </Link>
        </div>
      )}

      {/* Upcoming + Credits */}
      <div className="ov-grid">
        <section className="surface">
          <div className="surface-head">
            <h2>
              Upcoming
              <span className="count">{upcoming.length} booked</span>
            </h2>
            <Link className="link-arrow" href="/account/bookings">
              All bookings <Icon.arrowR />
            </Link>
          </div>
          <div className="surface-body">
            {upcoming.length === 0 ? (
              <p className="empty">No upcoming sessions.</p>
            ) : (
              upcoming.slice(0, 5).map((b) => {
                const dt = parseISO(b.starts_at);
                return (
                  <div className="row-item" key={b.id}>
                    <div className="ri-main">
                      <div className="ri-title">{serviceName.get(b.service_id) ?? 'Session'}</div>
                      <div className="ri-sub">
                        {format(dt, 'EEE dd MMM')} · {formatTime(dt)} · {locationName.get(b.location_id) ?? '—'}
                      </div>
                    </div>
                    <div className="ri-actions">
                      <span className="pill pill--dark">{bookingStatusLabel(b.status)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="surface">
          <div className="surface-head">
            <h2>
              Credits
              <span className="count">{sessionsLeft} sessions left</span>
            </h2>
            <Link className="link-arrow" href="/account/packages">
              Manage <Icon.arrowR />
            </Link>
          </div>
          <div className="surface-body">
            {activePkgs.length === 0 ? (
              <p className="empty">No active package.</p>
            ) : (
              activePkgs.map((p) => {
                const alloc = (p.sessions_remaining as Record<string, number>) || {};
                const left = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
                return (
                  <div className="row-item" key={p.id}>
                    <div className="ri-main">
                      <div className="ri-title">{packageName.get(p.package_id) ?? 'Package'}</div>
                      <div className="ri-sub">
                        {p.expires_at ? `Expires ${format(parseISO(p.expires_at), 'dd MMM yyyy')}` : 'No expiry'}
                      </div>
                    </div>
                    <div className="ri-actions">
                      <span className="pill pill--ok">{left} left</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Recent history + Research */}
      <div className="ov-grid" style={{ marginTop: 20 }}>
        <section className="surface">
          <div className="surface-head">
            <h2>
              Recent history
              <span className="count">{past.length} past</span>
            </h2>
          </div>
          <div className="surface-body">
            {past.length === 0 ? (
              <p className="empty">No past sessions yet.</p>
            ) : (
              past.slice(0, 5).map((b) => {
                const dt = parseISO(b.starts_at);
                return (
                  <div className="row-item" key={b.id}>
                    <div className="ri-main">
                      <div className="ri-title">{serviceName.get(b.service_id) ?? 'Session'}</div>
                      <div className="ri-sub">
                        {format(dt, 'EEE dd MMM')} · {locationName.get(b.location_id) ?? '—'}
                      </div>
                    </div>
                    <div className="ri-actions">
                      <span className={`status-dot ${b.status === 'completed' ? 'is-done' : 'is-cancelled'}`}>
                        {bookingStatusLabel(b.status)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="surface">
          <div className="surface-head">
            <h2>Research</h2>
            <Link className="link-arrow" href="/account/research">
              View all <Icon.arrowR />
            </Link>
          </div>
          <div className="surface-body">
            {reads.length === 0 ? (
              <p className="empty">No articles published yet.</p>
            ) : (
              reads.map((a) => (
                <Link className="row-item is-clickable" key={a.id} href={`/account/research/${a.slug}`}>
                  <div className="ri-main">
                    <div className="ri-title">{a.title}</div>
                    <div className="ri-sub">
                      {a.category ? `${a.category} · ` : ''}
                      {a.published_at ? format(parseISO(a.published_at), 'dd MMM yyyy') : ''}
                    </div>
                  </div>
                  <Icon.arrowR />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function NextSessionCard({
  booking,
  serviceName,
  locationName,
}: {
  booking: BookingRow;
  serviceName: string;
  locationName: string;
}) {
  const start = parseISO(booking.starts_at);
  const end = parseISO(booking.ends_at);
  const days = differenceInCalendarDays(start, new Date());
  const inLabel = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));

  return (
    <section className="next-card">
      <div className="next-kicker">Next session · {inLabel}</div>
      <h2 className="next-headline">
        {serviceName} <em>at {format(start, 'h:mma').toLowerCase()}</em>
      </h2>
      <div className="next-meta">
        <div>
          <div className="next-meta-k">When</div>
          <div className="next-meta-v">{format(start, 'EEE dd MMM · h:mma').replace(/AM|PM/i, (m) => m.toLowerCase())}</div>
        </div>
        <div>
          <div className="next-meta-k">Where</div>
          <div className="next-meta-v">{locationName}</div>
        </div>
        <div>
          <div className="next-meta-k">Duration</div>
          <div className="next-meta-v">{durationMin} min</div>
        </div>
      </div>
      <div className="next-actions">
        <Link className="hero-cta" href="/account/bookings">
          Manage <Icon.arrowR />
        </Link>
        <Link className="hero-cta hero-cta--ghost" href="/account/book">
          Book another
        </Link>
      </div>
    </section>
  );
}
