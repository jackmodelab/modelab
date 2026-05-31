import { requireClient } from '@/lib/auth/guards';
import { Icon } from '@/components/portal/icons';

export const metadata = { title: 'Billing — MODE Lab' };

/**
 * Billing — styled per the design handoff but inert for now.
 *
 * The handoff specs a full Stripe-backed billing screen (invoices, saved
 * payment methods, BECS Direct Debit mandate, auto-pay). None of that backend
 * exists yet (no `invoices` / `payment_methods` tables, Stripe not wired), so
 * this renders the real layout with empty states and disabled controls —
 * clearly marked "coming soon" — ready to be wired when Stripe lands.
 */
export default async function BillingPage() {
  await requireClient();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Billing &amp; invoices</p>
          <h1>Payments.</h1>
        </div>
        <div className="page-head-actions">
          <span className="pill">Coming soon</span>
        </div>
      </header>

      {/* Bill summary */}
      <div className="bill-summary">
        <div className="stat-card">
          <div className="k">Outstanding</div>
          <div className="v">$0.00</div>
          <div className="sub">0 invoices</div>
        </div>
        <div className="stat-card">
          <div className="k">Paid · this year</div>
          <div className="v">$0.00</div>
          <div className="sub">0 invoices</div>
        </div>
        <div className="stat-card">
          <div className="k">Next auto-charge</div>
          <div className="v" style={{ fontSize: '1.5rem' }}>—</div>
          <div className="sub">Nothing scheduled</div>
        </div>
        <div className="stat-card">
          <div className="k">Default method</div>
          <div className="v" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>—</div>
          <div className="sub">Add a method below</div>
        </div>
      </div>

      {/* Payment methods */}
      <section className="surface" style={{ marginBottom: 20 }}>
        <div className="surface-head">
          <h2>
            Payment methods
            <span className="count">0 saved</span>
          </h2>
          <button className="btn btn--mini btn--ghost" type="button" disabled title="Card payments — coming soon">
            <Icon.plus /> Add method
          </button>
        </div>
        <div className="pay-methods">
          <div className="empty">
            No payment methods yet. Card &amp; bank setup lands when checkout goes live.
          </div>
        </div>
        <div className="stripe-foot-card">
          <div className="l">
            <Icon.card />
            <span>Card and bank details will be stored by Stripe — MODE Lab never sees them.</span>
          </div>
          <div>
            Powered by <span className="stripe-wordmark">Stripe</span>
          </div>
        </div>
      </section>

      {/* Subscription & auto-pay */}
      <section className="surface" style={{ marginBottom: 20 }}>
        <div className="surface-head">
          <h2>Subscription &amp; auto-pay</h2>
        </div>
        <div className="autopay-row">
          <div className="l">
            <div className="t">Auto-pay subscription invoices</div>
            <div className="s">
              Charges your default method on the renewal date. You&rsquo;ll be notified 3 days before.
            </div>
          </div>
          <button className="switch" type="button" disabled aria-label="Toggle auto-pay" aria-pressed={false} />
        </div>
        <div className="mandate-block">
          <div className="h">BECS Direct Debit mandate</div>
          <div className="body">
            When you add an Australian bank account, you&rsquo;ll authorise MODE Lab Pty Ltd to debit it via the Bulk
            Electronic Clearing System. Debits appear on your statement as <b>MODELAB</b>. Your mandate reference and
            acceptance date will show here once set up.
          </div>
          <span className="ref">No active mandate</span>
        </div>
      </section>

      {/* Invoices */}
      <section className="surface">
        <div className="surface-head">
          <h2>
            Invoices
            <span className="count">0 total</span>
          </h2>
        </div>
        <div className="surface-body">
          <div className="empty">
            No invoices yet. Receipts and outstanding balances will appear here once self-serve checkout is live.
          </div>
        </div>
      </section>
    </>
  );
}
