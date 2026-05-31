import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { updateStaffProfile, disconnectGoogleCalendar } from '@/lib/portal/actions';
import { googleConfigured } from '@/lib/google/oauth';

export const metadata = { title: 'Profile — MODE Lab' };

const GOOGLE_FLASH: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  connected: { tone: 'ok', text: 'Google Calendar connected. New bookings will appear on your calendar.' },
  denied: { tone: 'warn', text: 'Google Calendar connection was cancelled.' },
  error: { tone: 'warn', text: 'Something went wrong connecting Google Calendar. Please try again.' },
  unconfigured: { tone: 'warn', text: 'Google Calendar isn’t configured on the server yet.' },
};

export default async function StaffProfilePage({
  searchParams,
}: {
  searchParams?: { google?: string };
}) {
  const { user, staff } = await requireStaff();

  const googleConnected = Boolean(staff.google_refresh_token);
  const googleEmail = staff.google_calendar_email;
  const connectedAt = staff.google_calendar_connected_at;
  const flash = searchParams?.google ? GOOGLE_FLASH[searchParams.google] : undefined;
  const memberSince = staff.created_at ? format(parseISO(staff.created_at), 'MMM yyyy') : '—';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Account</p>
          <h1>Profile.</h1>
        </div>
      </header>

      <div className="profile-grid">
        {/* Contact details */}
        <form action={updateStaffProfile} className="p-form">
          <h2 style={{ fontSize: 14.5, fontWeight: 600 }}>Your details</h2>
          <div className="p-field">
            <label htmlFor="display_name">Display name</label>
            <input id="display_name" name="display_name" defaultValue={staff.display_name ?? ''} maxLength={120} />
          </div>
          <div className="p-form-row-2">
            <div className="p-field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" defaultValue={staff.title ?? ''} maxLength={120} placeholder="Exercise Scientist" />
            </div>
            <div className="p-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" defaultValue={user.email ?? ''} disabled />
              <span className="p-field-hint">Managed by your sign-in.</span>
            </div>
          </div>
          <div className="p-field">
            <label htmlFor="bio">Bio</label>
            <textarea id="bio" name="bio" defaultValue={staff.bio ?? ''} rows={3} maxLength={2000} placeholder="Shown to clients when they pick a coach." />
          </div>
          <div className="p-form-actions">
            <button className="btn" type="submit">
              Save changes
            </button>
            <Link className="link-arrow" href="/portal">
              ← Back to today
            </Link>
          </div>
        </form>

        {/* Side stack */}
        <div className="stack">
          {/* Google Calendar */}
          <section className="surface">
            <div className="surface-head">
              <h2>Google Calendar</h2>
              <span className={`pill ${googleConnected ? 'pill--ok' : ''}`}>{googleConnected ? 'On' : 'Off'}</span>
            </div>
            <div className="surface-body--pad">
              {flash && (
                <div
                  style={{
                    marginBottom: 14,
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: 13,
                    background: flash.tone === 'ok' ? '#eef7ee' : '#fff8e6',
                    border: `1px solid ${flash.tone === 'ok' ? '#bfe0bf' : '#f3e0a8'}`,
                    color: flash.tone === 'ok' ? '#2c5d2c' : '#7a5e10',
                  }}
                >
                  {flash.text}
                </div>
              )}

              <div style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.5, maxWidth: '54ch' }}>
                {googleConnected ? (
                  <>
                    Confirmed bookings are added to{' '}
                    <strong style={{ color: 'var(--engineered-black)' }}>{googleEmail || 'your Google Calendar'}</strong>{' '}
                    automatically, and the client is sent an invite.
                    {connectedAt ? (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--slate-soft)', letterSpacing: '0.04em', marginTop: 6 }}>
                        Connected {format(parseISO(connectedAt), 'd MMM yyyy')}
                      </div>
                    ) : null}
                  </>
                ) : (
                  'Connect your Google account so confirmed bookings are added to your calendar automatically, with the client invited.'
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                {!googleConfigured() ? (
                  <span style={{ color: 'var(--slate-soft)', fontSize: 12.5 }}>Server not configured yet.</span>
                ) : googleConnected ? (
                  <form action={disconnectGoogleCalendar}>
                    <button className="btn btn--ghost btn--mini" type="submit">
                      Disconnect
                    </button>
                  </form>
                ) : (
                  <a className="btn btn--mini" href="/api/google/oauth/start">
                    Connect Google Calendar
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* Account meta */}
          <section className="surface">
            <div className="surface-head">
              <h2>Account</h2>
            </div>
            <div className="kv-row">
              <div className="kv-k">Role</div>
              <div className="kv-v">Coach / Staff</div>
            </div>
            <div className="kv-row">
              <div className="kv-k">Staff since</div>
              <div className="kv-v">{memberSince}</div>
            </div>
            <div className="kv-row">
              <div className="kv-k">Availability</div>
              <div className="kv-v">
                <Link className="link-arrow" href="/portal/availability">Manage weekly blocks →</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
