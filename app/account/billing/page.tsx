import Link from 'next/link';
import { requireClient } from '@/lib/auth/guards';
import { Icon } from '@/components/portal/icons';

export const metadata = { title: 'Payments — MODE Lab' };

/**
 * Payments — pay-in-studio posture for launch.
 *
 * There is no online checkout yet (no Stripe, no `invoices` / `payment_methods`
 * backend). Rather than show an inert Stripe mockup that implies card payment is
 * available, this page is honest: sessions and packages are settled in studio.
 * When self-serve checkout is built, this becomes the real billing screen.
 */
export default async function BillingPage() {
  await requireClient();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Payments</p>
          <h1>Payments.</h1>
        </div>
      </header>

      <section className="surface" style={{ marginBottom: 20 }}>
        <div className="surface-head">
          <h2>How you pay</h2>
        </div>
        <div className="surface-body--pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Icon.card />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>Settled in studio</div>
              <p style={{ color: 'var(--slate)', fontSize: 13.5, lineHeight: 1.6, marginTop: 6 }}>
                Sessions and packages are paid for with us in person — card, cash or bank transfer.
                When you book online you&rsquo;re reserving a slot; payment is taken at your session.
                There&rsquo;s nothing to set up here.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="surface">
        <div className="surface-head">
          <h2>Your packages</h2>
        </div>
        <div className="surface-body--pad">
          <p style={{ color: 'var(--slate)', fontSize: 13.5, lineHeight: 1.6 }}>
            See the packages you hold and how many sessions are left on your{' '}
            <Link className="text-link" href="/account/packages">
              packages page
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
