import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatTime, bookingStatusLabel } from '@/lib/format';
import { ClientFiles } from '@/components/portal/client-files';
import { ClientDangerZone } from '@/components/portal/client-danger-zone';
import type { ClientRow, BookingRow, ClientPackageRow, DocumentRow } from '@/types/database';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Client — MODE Lab`, description: id };
}

const TIER_LABEL: Record<string, string> = {
  standard: 'Standard',
  student_senior: 'Student / Senior',
  friends_family: 'F&F',
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; file_error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = (searchParams ? await searchParams : {}) as { error?: string; file_error?: string };
  const supabase = await createSupabaseServer();

  const [{ data: clientData }, { data: bookings }, { data: pkgs }, { data: services }, { data: locations }, { data: docs }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).maybeSingle(),
    supabase.from('bookings').select('*').eq('client_id', id).order('starts_at', { ascending: true }),
    supabase.from('client_packages').select('*').eq('client_id', id).eq('status', 'active'),
    supabase.from('services').select('id,name'),
    supabase.from('locations').select('id,name,suburb'),
    supabase.from('documents').select('id,title,description,file_type,created_at').eq('client_id', id).order('created_at', { ascending: false }),
  ]);

  const client = clientData as ClientRow | null;
  if (!client) notFound();

  const bks = (bookings ?? []) as BookingRow[];
  const activePkgs = (pkgs ?? []) as ClientPackageRow[];
  const documents = (docs ?? []) as Pick<DocumentRow, 'id' | 'title' | 'description' | 'file_type' | 'created_at'>[];
  const archived = Boolean(client.archived_at);
  const fileError = (['missing', 'size', 'upload'] as const).find((e) => e === sp.file_error);
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
          {archived && <span className="pill">Archived</span>}
          <span className="pill">{TIER_LABEL[client.discount_tier] ?? client.discount_tier}</span>
        </div>
      </header>

      {archived && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#fff8e6', border: '1px solid #f3e0a8', borderRadius: 10,
            padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#7a5e10',
          }}
        >
          This client is archived — they’re hidden from active lists and can’t access the member portal.
          Reactivate them below to restore access.
        </div>
      )}

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

      <ClientFiles clientId={client.id} documents={documents} uploadError={fileError} />

      <ClientDangerZone
        clientId={client.id}
        clientName={client.full_name ?? ''}
        archived={archived}
        nameError={sp.error === 'name'}
      />
    </>
  );
}
