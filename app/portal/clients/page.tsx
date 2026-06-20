import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { Icon } from '@/components/portal/icons';
import type { ClientRow, BookingRow } from '@/types/database';

export const metadata = { title: 'Clients — MODE Lab' };

const TIER_LABEL: Record<string, string> = {
  standard: 'Standard',
  student_senior: 'Student',
  friends_family: 'F&F',
};

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; tier?: string; view?: string }> }) {
  await requireStaff();
  const supabase = await createSupabaseServer();
  const { q: qParam, tier, view: viewParam } = await searchParams;
  const q = (qParam ?? '').trim().toLowerCase();
  const tierFilter = (tier ?? '').trim();
  const view = ['active', 'archived', 'all'].includes(viewParam ?? '') ? viewParam! : 'active';

  const now = new Date().toISOString();

  const [{ data: clients }, { data: bookings }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('bookings').select('id,client_id,starts_at,status').order('starts_at', { ascending: true }),
  ]);

  const all = (clients ?? []) as ClientRow[];
  const bks = (bookings ?? []) as Pick<BookingRow, 'id' | 'client_id' | 'starts_at' | 'status'>[];

  // Which clients have actually set up their account (signed in at least once)?
  // inviteUserByEmail sets auth_user_id at invite time, so we read the auth users'
  // last_sign_in_at to flag those still sitting on an unaccepted invite.
  const signedIn = new Set<string>();
  const admin = createSupabaseAdmin();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) if (u.last_sign_in_at) signedIn.add(u.id);
    if (error || users.length < 200) break;
  }

  const sessionCounts = new Map<string, number>();
  const nextBooking = new Map<string, string>();
  for (const b of bks) {
    if (b.status === 'completed') sessionCounts.set(b.client_id, (sessionCounts.get(b.client_id) ?? 0) + 1);
    if (b.starts_at >= now && !b.status?.startsWith('cancelled') && b.status !== 'no_show') {
      if (!nextBooking.has(b.client_id)) nextBooking.set(b.client_id, b.starts_at);
    }
  }

  let filtered = all;
  if (view === 'active') filtered = filtered.filter((c) => !c.archived_at);
  else if (view === 'archived') filtered = filtered.filter((c) => Boolean(c.archived_at));
  const activeCount = all.filter((c) => !c.archived_at).length;
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
          <span className="pill">{activeCount} active</span>
          <Link className="btn" href="/portal/clients/new">
            Invite client
          </Link>
        </div>
      </header>

      <form method="get" className="p-form client-filter">
        <div className="p-field cf-search">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Name, email, phone…" />
        </div>
        <div className="p-field">
          <label htmlFor="tier">Tier</label>
          <select id="tier" name="tier" defaultValue={tierFilter}>
            <option value="">All tiers</option>
            <option value="standard">Standard</option>
            <option value="student_senior">Student / Senior</option>
            <option value="friends_family">F&amp;F</option>
          </select>
        </div>
        <div className="p-field">
          <label htmlFor="view">Status</label>
          <select id="view" name="view" defaultValue={view}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        <button className="btn cf-submit" type="submit">Filter</button>
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
              const pending = !c.archived_at && (!c.auth_user_id || !signedIn.has(c.auth_user_id));
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
                    {c.archived_at && <span className="pill">Archived</span>}
                    {pending && <span className="pill">Invite pending</span>}
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
