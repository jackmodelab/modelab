import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Icon } from '@/components/portal/icons';
import type { ClientRow, BookingRow } from '@/types/database';

export const metadata = { title: 'Clients — MODE Lab' };

const TIER_LABEL: Record<string, string> = {
  standard: 'Standard',
  student_senior: 'Student',
  friends_family: 'F&F',
};

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; tier?: string }> }) {
  await requireStaff();
  const supabase = await createSupabaseServer();
  const { q: qParam, tier } = await searchParams;
  const q = (qParam ?? '').trim().toLowerCase();
  const tierFilter = (tier ?? '').trim();

  const now = new Date().toISOString();

  const [{ data: clients }, { data: bookings }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('bookings').select('id,client_id,starts_at,status').order('starts_at', { ascending: true }),
  ]);

  const all = (clients ?? []) as ClientRow[];
  const bks = (bookings ?? []) as Pick<BookingRow, 'id' | 'client_id' | 'starts_at' | 'status'>[];

  const sessionCounts = new Map<string, number>();
  const nextBooking = new Map<string, string>();
  for (const b of bks) {
    if (b.status === 'completed') sessionCounts.set(b.client_id, (sessionCounts.get(b.client_id) ?? 0) + 1);
    if (b.starts_at >= now && !b.status?.startsWith('cancelled') && b.status !== 'no_show') {
      if (!nextBooking.has(b.client_id)) nextBooking.set(b.client_id, b.starts_at);
    }
  }

  let filtered = all;
  if (q) {
    filtered = filtered.filter((c) =>
      (c.full_name ?? '').toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q),
    );
  }
  if (tierFilter && ['standard', 'student_senior', 'friends_family'].includes(tierFilter)) {
    filtered = filtered.filter((c) => c.discount_tier === tierFilter);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Clients</p>
          <h1>Clients.</h1>
        </div>
        <div className="page-head-actions">
          <span className="pill">{all.length} total</span>
        </div>
      </header>

      <form method="get" className="p-form" style={{ maxWidth: 'none', flexDirection: 'row', alignItems: 'end', gap: 12, padding: 16, marginBottom: 18 }}>
        <div className="p-field" style={{ flex: 1 }}>
          <label htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Name, email, phone…" />
        </div>
        <div className="p-field" style={{ width: 180 }}>
          <label htmlFor="tier">Tier</label>
          <select id="tier" name="tier" defaultValue={tierFilter}>
            <option value="">All tiers</option>
            <option value="standard">Standard</option>
            <option value="student_senior">Student / Senior</option>
            <option value="friends_family">F&amp;F</option>
          </select>
        </div>
        <button className="btn" type="submit">Filter</button>
      </form>

      <section className="surface">
        <div className="surface-head">
          <h2>
            Directory
            <span className="count">{filtered.length} shown</span>
          </h2>
        </div>
        <div className="surface-body">
          {filtered.length === 0 ? (
            <p className="empty">No clients match.</p>
          ) : (
            filtered.map((c) => {
              const next = nextBooking.get(c.id);
              const sessions = sessionCounts.get(c.id) ?? 0;
              return (
                <Link className="row-item is-clickable" key={c.id} href={`/portal/clients/${c.id}`}>
                  <div className="ri-main">
                    <div className="ri-title">{c.full_name || '—'}</div>
                    <div className="ri-sub">
                      {c.email}
                      {c.phone ? ` · ${c.phone}` : ''}
                      {' · '}
                      {sessions} done
                      {next ? ` · next ${format(parseISO(next), 'dd MMM h:mma').toLowerCase()}` : ' · no upcoming'}
                    </div>
                  </div>
                  <div className="ri-actions">
                    <span className="pill">{TIER_LABEL[c.discount_tier] ?? c.discount_tier}</span>
                    <Icon.arrowR />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
