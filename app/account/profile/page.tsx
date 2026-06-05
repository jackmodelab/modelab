import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireClient } from '@/lib/auth/guards';
import { updateProfile } from '@/lib/account/actions';
import { Icon } from '@/components/portal/icons';

export const metadata = { title: 'Profile — MODE Lab' };

export default async function ProfilePage() {
  const { user, client } = await requireClient();

  if (!client) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="kicker">MODE Lab · Member</p>
            <h1>Profile.</h1>
          </div>
        </header>
        <p className="empty">Setting up your profile.</p>
      </>
    );
  }

  const memberSince = format(parseISO(client.created_at), 'MMM yyyy');
  const emergency = (client.emergency_contact ?? {}) as { name?: string; phone?: string };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Member</p>
          <h1>Profile.</h1>
        </div>
      </header>

      <div className="profile-grid">
        {/* Contact details */}
        <form action={updateProfile} className="p-form">
          <h2 style={{ fontSize: 14.5, fontWeight: 600 }}>Contact details</h2>
          <div className="p-field">
            <label htmlFor="full_name">Full name</label>
            <input id="full_name" name="full_name" defaultValue={client.full_name ?? ''} maxLength={120} />
          </div>
          <div className="p-form-row-2">
            <div className="p-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" defaultValue={user.email ?? client.email} disabled />
              <span className="p-field-hint">Managed by your sign-in. Contact us to change it.</span>
            </div>
            <div className="p-field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" type="tel" defaultValue={client.phone ?? ''} maxLength={40} placeholder="0400 000 000" />
            </div>
          </div>
          <div className="p-field">
            <label htmlFor="member_since">Member since</label>
            <input id="member_since" defaultValue={memberSince} disabled />
          </div>
          <div className="p-form-actions">
            <button className="btn" type="submit">
              Save changes
            </button>
            <Link className="link-arrow" href="/account">
              ← Back to account
            </Link>
          </div>
        </form>

        {/* Side stack */}
        <div className="stack">
          <section className="surface">
            <div className="surface-head">
              <h2>Google Calendar</h2>
              <span className="pill pill--ok">On</span>
            </div>
            <div className="surface-body--pad">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Icon.calendar />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>Sessions sync automatically</div>
                  <div style={{ color: 'var(--slate)', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                    Every confirmed booking is sent to you as a calendar invite — accept it once and your sessions
                    appear in Google Calendar (or any calendar app), with reminders.
                  </div>
                </div>
              </div>
              <p style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate-soft)', letterSpacing: '0.04em' }}>
                Invites go to {user.email ?? client.email}.
              </p>
            </div>
          </section>

          <section className="surface">
            <div className="surface-head">
              <h2>Emergency contact</h2>
            </div>
            <div className="surface-body--pad">
              {emergency.name || emergency.phone ? (
                <>
                  <div style={{ fontWeight: 500 }}>{emergency.name ?? '—'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)', letterSpacing: '0.02em', marginTop: 4 }}>
                    {emergency.phone ?? '—'}
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--slate)', fontSize: 13 }}>
                  No emergency contact on file. Add one — we&rsquo;ll only use it if we can&rsquo;t reach you about a session.
                </p>
              )}
              <p style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate-soft)', letterSpacing: '0.04em' }}>
                Editing comes in the next release.
              </p>
            </div>
          </section>

          <section className="surface">
            <div className="surface-head">
              <h2>Payments</h2>
            </div>
            <div className="surface-body--pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon.card />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>Paid in studio</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)', marginTop: 3, letterSpacing: '0.02em' }}>
                    Settle sessions and packages with us in person — card, cash or transfer.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="surface">
            <div className="surface-head">
              <h2>Pause membership</h2>
            </div>
            <div className="surface-body--pad">
              <p style={{ color: 'var(--slate)', fontSize: 13 }}>
                Going away or injured? You can pause your subscription for up to 8 weeks per cycle.
              </p>
              <button className="btn btn--ghost btn--mini" style={{ marginTop: 14 }} type="button" disabled>
                Pause
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
