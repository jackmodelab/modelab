import { requireClient } from '@/lib/auth/guards';
import { getScreeningForClient } from '@/lib/screening/queries';
import { ScreeningForm } from '@/components/account/screening-form';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Pre-screening — MODE Lab' };

export default async function ScreeningPage({
  searchParams,
}: {
  searchParams: Promise<{ completed?: string }>;
}) {
  const { user, client } = await requireClient();

  if (!client) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="kicker">MODE Lab · Member</p>
            <h1>Pre-screening.</h1>
          </div>
        </header>
        <p className="empty">We&rsquo;re setting up your profile. Refresh in a moment, or contact us if this persists.</p>
      </>
    );
  }

  const screening = await getScreeningForClient(client.id);
  const justCompleted = (await searchParams).completed === '1';
  const email = client.email ?? user.email ?? '';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Member · Intake</p>
          <h1>New client pre-screening.</h1>
        </div>
      </header>

      <p style={{ color: 'var(--slate, #6b6b6b)', fontSize: 14, maxWidth: 680, marginBottom: 20, lineHeight: 1.55 }}>
        Please complete this form prior to your initial session. It enables a safe, evidence-based prescription tailored
        to your health status, training history, and goals. All information is kept confidential. Items marked{' '}
        <strong style={{ color: '#171717' }}>MANDATORY</strong> are required to proceed.
      </p>

      {justCompleted && screening ? (
        <div style={{ background: '#e9f7ef', border: '1px solid #b7e1c6', color: '#1e7a45', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          Thank you — your pre-screening is complete. You can now book your first session.
        </div>
      ) : screening ? (
        <div style={{ background: '#e9f7ef', border: '1px solid #b7e1c6', color: '#1e7a45', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          Completed on {formatDateTime(screening.submitted_at)}. You can review and update your answers below.
        </div>
      ) : null}

      <ScreeningForm initialData={screening} defaultEmail={email} />
    </>
  );
}
