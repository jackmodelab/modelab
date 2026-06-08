import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatTime } from '@/lib/format';
import { acceptBookingRequest, declineBookingRequest } from '@/lib/portal/actions';
import { Icon } from '@/components/portal/icons';
import type { BookingRow, ClientRow } from '@/types/database';

export const metadata = { title: 'Requests — MODE Lab' };

export default async function RequestsPage() {
  await requireStaff();
  const supabase = await createSupabaseServer();

  const [{ data: bookings }, { data: clients }, { data: services }, { data: locations }, { data: staff }] =
    await Promise.all([
      // Single-operator model: surface every pending request (mirrors the
      // shared-clients / any-staff-edits decision in lib/portal/actions.ts).
      supabase.from('bookings').select('*').eq('status', 'pending').order('starts_at', { ascending: true }),
      supabase.from('clients').select('id,full_name,email,phone'),
      supabase.from('services').select('id,name'),
      supabase.from('locations').select('id,name,suburb'),
      supabase.from('staff').select('id,display_name'),
    ]);

  const rows = (bookings ?? []) as BookingRow[];
  const client = new Map(((clients ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email' | 'phone'>[]).map((c) => [c.id, c]));
  const serviceName = new Map(((services ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const locationName = new Map(((locations ?? []) as { id: string; name: string; suburb: string | null }[]).map((l) => [l.id, l.suburb || l.name]));
  const staffName = new Map(((staff ?? []) as { id: string; display_name: string }[]).map((s) => [s.id, s.display_name]));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Requests</p>
          <h1>Time requests.</h1>
        </div>
      </header>

      <p style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.55, maxWidth: '64ch', marginBottom: 18 }}>
        Members can request a specific time outside the standard hourly slots. Accepting confirms the session and
        adds it to your calendar; declining notifies the member it couldn&apos;t be accommodated.
      </p>

      <section className="surface">
        <div className="surface-body">
          {rows.length === 0 ? (
            <p className="empty">No pending requests.</p>
          ) : (
            rows.map((b) => {
              const c = client.get(b.client_id);
              const start = parseISO(b.starts_at);
              const end = parseISO(b.ends_at);
              return (
                <div className="bk-row" key={b.id}>
                  <div className="bk-day">
                    <div className="mon">{format(start, 'MMM')}</div>
                    <div className="num">{format(start, 'd')}</div>
                    <div className="dow">{format(start, 'EEE')}</div>
                  </div>
                  <div className="bk-main">
                    <div className="bk-title">
                      {serviceName.get(b.service_id) ?? 'Session'} · {c?.full_name || c?.email || 'Client'}
                    </div>
                    <div className="bk-meta">
                      <span>
                        {formatTime(start).toLowerCase()} to {formatTime(end).toLowerCase()}
                      </span>
                      <span className="dot">·</span>
                      <span>{staffName.get(b.staff_id ?? '') ?? 'Coach'}</span>
                      <span className="dot">·</span>
                      <span>{locationName.get(b.location_id) ?? '—'}</span>
                      {c?.phone && (
                        <>
                          <span className="dot">·</span>
                          <span>{c.phone}</span>
                        </>
                      )}
                    </div>
                    {b.notes && (
                      <div className="bk-meta" style={{ marginTop: 4, color: 'var(--slate)' }}>
                        “{b.notes}”
                      </div>
                    )}
                  </div>
                  <div className="bk-actions">
                    <form action={acceptBookingRequest} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="btn btn--mini" type="submit">
                        <Icon.check /> Accept
                      </button>
                    </form>
                    <form action={declineBookingRequest} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="btn btn--mini btn--danger" type="submit">
                        Decline
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
