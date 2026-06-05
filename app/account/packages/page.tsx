import Link from 'next/link';
import { format, parseISO, differenceInDays } from 'date-fns';
import { requireClient } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { ClientPackageRow, PackageRow } from '@/types/database';
import { Icon } from '@/components/portal/icons';

export const metadata = { title: 'Packages — MODE Lab' };

function sumAlloc(json: unknown): number {
  if (!json || typeof json !== 'object') return 0;
  return Object.values(json as Record<string, unknown>).reduce<number>((sum, v) => sum + (Number(v) || 0), 0);
}

export default async function PackagesPage() {
  const { client } = await requireClient();

  if (!client) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="kicker">MODE Lab · Member</p>
            <h1>Packages.</h1>
          </div>
        </header>
        <p className="empty">Setting up your profile.</p>
      </>
    );
  }

  const supabase = await createSupabaseServer();

  const [{ data: clientPkgs }, { data: catalog }] = await Promise.all([
    supabase
      .from('client_packages')
      .select('*')
      .eq('client_id', client.id)
      .order('purchased_at', { ascending: false }),
    supabase.from('packages').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
  ]);

  const pkgs = (clientPkgs ?? []) as ClientPackageRow[];
  const catalogList = (catalog ?? []) as PackageRow[];
  const catalogById = new Map(catalogList.map((p) => [p.id, p]));

  const today = new Date();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Member</p>
          <h1>Packages.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn" href="/account/book">
            <Icon.plus /> Book a session
          </Link>
        </div>
      </header>

      {pkgs.length === 0 ? (
        <section className="surface">
          <div className="empty" style={{ padding: '48px 24px' }}>
            No active package. Browse what we offer below.
          </div>
        </section>
      ) : (
        <div className="pkg-grid">
          {pkgs.map((cp) => {
            const catalogEntry = catalogById.get(cp.package_id);
            const total = sumAlloc(catalogEntry?.session_allocations);
            const remaining = sumAlloc(cp.sessions_remaining);
            const isSubscription = !!catalogEntry?.is_recurring;
            const isLow = !isSubscription && remaining > 0 && remaining <= 2;
            const isActive = cp.status === 'active';
            const expires = cp.expires_at ? parseISO(cp.expires_at) : null;
            const daysLeft = expires ? differenceInDays(expires, today) : null;
            return (
              <div
                key={cp.id}
                className={`pkg-card ${isActive ? 'is-active' : ''} ${isLow ? 'is-low' : ''}`}
              >
                <div className="pkg-head">
                  <div>
                    <div className="pkg-title">{catalogEntry?.name ?? 'Package'}</div>
                    <div className="pkg-kind">{isSubscription ? 'Subscription' : 'Session pack'}</div>
                  </div>
                  <span className={`pill ${cp.status === 'active' ? 'pill--ok' : ''}`}>
                    {cp.status}
                  </span>
                </div>
                <div className="pkg-progress">
                  <div className="pkg-progress-row">
                    <div className="pkg-progress-num">
                      {remaining}
                      {total > 0 && (
                        <em> / {total}</em>
                      )}
                    </div>
                    <div className="pkg-progress-label">
                      Sessions{isSubscription ? '/cycle' : ' left'}
                    </div>
                  </div>
                  {total > 0 && (
                    <div className="pkg-bar">
                      <div className="pkg-bar-fill" style={{ width: `${Math.max(0, Math.min(100, (remaining / total) * 100))}%` }} />
                    </div>
                  )}
                </div>
                <div className="pkg-foot">
                  <span>
                    {expires
                      ? `Expires ${format(expires, 'dd MMM yyyy')}${daysLeft != null && daysLeft >= 0 ? ` · ${daysLeft}d left` : ''}`
                      : 'No expiry'}
                  </span>
                  <Link className="link-arrow" href="/account/book">
                    Book <Icon.arrowR />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Catalog — view-only. Packages are purchased in studio (no online checkout). */}
      <section className="surface" style={{ marginTop: 28 }}>
        <div className="surface-head">
          <h2>
            Add more
            <span className="count">{catalogList.length} options</span>
          </h2>
        </div>
        <div className="surface-body">
          {catalogList.length === 0 ? (
            <p className="empty">No packages available yet.</p>
          ) : (
            catalogList.map((p) => (
              <div className="row-item" key={p.id}>
                <div className="ri-main">
                  <div className="ri-title">{p.name}</div>
                  <div className="ri-sub">
                    {p.tagline ?? ''}
                    {p.validity_days ? ` · ${p.validity_days}d validity` : ''}
                    {p.is_recurring ? ' · Auto-renew monthly' : ''}
                  </div>
                </div>
                <div className="ri-actions">
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                    ${(p.price_cents / 100).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <p style={{ marginTop: 14, color: 'var(--slate-soft)', fontSize: 11, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
        Packages are purchased in studio — just let your coach know and we&rsquo;ll set you up.
      </p>
    </>
  );
}
