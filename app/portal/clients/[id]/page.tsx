import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatTime, bookingStatusLabel } from '@/lib/format';
import type { ClientRow, BookingRow, ClientPackageRow } from '@/types/database';

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `Client — MODE Lab`, description: params.id };
}

const TIER_LABEL: Record<string, string> = {
  standard: 'Standard',
  student_senior: 'Student / Senior',
  friends_family: 'F&F',
};

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  await requireStaff();
  const supabase = createSupabaseServer();

  const [{ data: clientData }, { data: bookings }, { data: pkgs }, { data: services }, { data: locations }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('bookings').select('*').eq('client_id', params.id).order('starts_at', { ascending: true }),
    supabase.from('client_packages').select('*').eq('client_id', params.id).eq('status', 'active'),
    supabase.from('services').select('id,name'),
    supabase.from('locations').select('id,name,suburb'),
  ]);

  const client = clientData as ClientRow | null;
  if (!client) notFound();

  const bks = (bookings ?? []) as BookingRow[];
  const activePkgs = (pkgs ?? []) as ClientPackageRow[];
  const serviceName = new Map(((services ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const locationName = new Map(((locations ?? []) as { id: string; name: string; suburb: string | null }[]).map((l) => [l.id, l.suburb || l.name]));

  const now = new Date().toISOString();
  const upcoming = bks.filter((b) => b.starts_at >= now && !b.status?.startsWith('cancelled') && b.status !== 'no_show');
  const past = bks.filter((b) => b.starts_at < now || b.status === 'completed').reverse();

  const initials = (() => {
    const parts = (client.full_name || '').trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || (client.email[0] ?? '?').toUpperCase();
  })();

  return (
    <>
      <header className="page-head">
        <div>
          <Link className="link-arrow" href="/portal/clients" style={{ marginBottom: 8 }}>
            ← All clients
          </Link>
          <h1>{client.full_name || '—'}</h1>
        </div>
        <div className="page-head-actions">
          <span className="pill">{TIER_LABEL[client.discount_tier] ?? client.discount_tier}</span>
        </div>
      </header>

      <section className="surface" style={{ marginBottom: 20 }}>
        <div className="client-summary">
          <div className="client-avatar">{initials}</div>
          <div className="client-summary-text">
            <div className="n">{client.full_name || '—'}</div>
            <div className="e">{client.email}</div>
          </div>
        </div>
        <div className="kv-row">
          <div className="kv-k">Phone</div>
          <div className="kv-v">{client.phone || '—'}</div>
        </div>
        <div className="kv-row">
          <div className="kv-k">Member since</div>
          <div className="kv-v">{format(parseISO(client.created_at), 'dd MMM yyyy')}</div>
        </div>
        <div className="kv-row">
          <div className="kv-k">Health notes</div>
          <div className="kv-v">{client.health_notes || <span style={{ color: 'var(--slate-soft)' }}>None on file</span>}</div>
        </div>
      </section>

      <div className="detail-grid">
        <section className="surface">
          <div className="surface-head">
            <h2>
              Upcoming
              <span className="count">{upcoming.length}</span>
            </h2>
          </div>
          <div className="surface-body">
            {upcoming.length === 0 ? (
              <p className="empty">No upcoming bookings.</p>
            ) : (
              upcoming.slice(0, 6).map((b) => {
                const dt = parseISO(b.starts_at);
                return (
                  <Link className="row-item is-clickable" key={b.id} href={`/portal/bookings/${b.id}/edit`}>
                    <div className="ri-main">
                      <div className="ri-title">{serviceName.get(b.service_id) ?? 'Session'}</div>
                      <div className="ri-sub">
                        {format(dt, 'EEE dd MMM')} · {formatTime(dt).toLowerCase()} · {locationName.get(b.location_id) ?? '—'}
                      </div>
                    </div>
                    <span className="pill pill--dark">{bookingStatusLabel(b.status)}</span>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section className="surface">
          <div className="surface-head">
            <h2>
              History
              <span className="count">{past.length}</span>
            </h2>
          </div>
          <div className="surface-body">
            {past.length === 0 ? (
              <p className="empty">No past sessions.</p>
            ) : (
              past.slice(0, 6).map((b) => {
                const dt = parseISO(b.starts_at);
                const cancelled = b.status?.startsWith('cancelled') || b.status === 'no_show';
                return (
                  <div className="row-item" key={b.id}>
                    <div className="ri-main">
                      <div className="ri-title">{serviceName.get(b.service_id) ?? 'Session'}</div>
                      <div className="ri-sub">{format(dt, 'dd MMM yyyy')} · {locationName.get(b.location_id) ?? '—'}</div>
                    </div>
                    <span className={`status-dot ${b.status === 'completed' ? 'is-done' : cancelled ? 'is-cancelled' : ''}`}>
                      {bookingStatusLabel(b.status)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="detail-grid" style={{ marginTop: 20 }}>
        <section className="surface">
          <div className="surface-head">
            <h2>
              Active packages
              <span className="count">{activePkgs.length}</span>
            </h2>
          </div>
          <div className="surface-body">
            {activePkgs.length === 0 ? (
              <p className="empty">No active package.</p>
            ) : (
              activePkgs.map((p) => (
                <div className="row-item" key={p.id}>
                  <div className="ri-main">
                    <div className="ri-title">Package</div>
                    <div className="ri-sub">
                      {p.expires_at ? `Expires ${format(parseISO(p.expires_at), 'dd MMM yyyy')}` : 'No expiry'}
                    </div>
                  </div>
                  <span className="pill pill--ok">Active</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
