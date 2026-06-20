import Link from 'next/link';
import { requireStaff } from '@/lib/auth/guards';
import { inviteClient } from '@/lib/portal/actions';

export const metadata = { title: 'Invite client — MODE Lab' };

const ERRORS: Record<string, string> = {
  email: 'Enter a valid email address.',
  dupe: 'That email already has an account — they can sign in or reset their password.',
  '1': 'Couldn’t send that invite — please check the details and try again.',
};

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? ERRORS['1'] : null;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Invite client</p>
          <h1>Invite a client.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--ghost" href="/portal/clients">
            ← Clients
          </Link>
        </div>
      </header>

      <p style={{ color: 'var(--slate)', maxWidth: '60ch', marginBottom: '1.5rem', fontSize: '13.5px', lineHeight: 1.55 }}>
        Emails the client a link to set their own password, then adds them to
        your clients. They’re bookable straight away. Only an email is required —
        you can fill in the rest now or later.
      </p>

      {message && (
        <div className="p-form-banner" role="alert">
          {message}
        </div>
      )}

      <form action={inviteClient} className="p-form">
        <div className="p-form-row-2">
          <div className="p-field">
            <label htmlFor="full_name">Full name</label>
            <input id="full_name" name="full_name" placeholder="Jane Smith" autoComplete="off" />
          </div>
          <div className="p-field">
            <label htmlFor="email">Email *</label>
            <input id="email" name="email" type="email" placeholder="jane@example.com" required autoComplete="off" />
          </div>
        </div>

        <div className="p-form-row-2">
          <div className="p-field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" placeholder="04xx xxx xxx" autoComplete="off" />
          </div>
          <div className="p-field">
            <label htmlFor="date_of_birth">Date of birth</label>
            <input id="date_of_birth" name="date_of_birth" type="date" />
          </div>
        </div>

        <div className="p-field">
          <label htmlFor="discount_tier">Pricing tier</label>
          <select id="discount_tier" name="discount_tier" defaultValue="standard">
            <option value="standard">Standard</option>
            <option value="student_senior">Student / Senior</option>
            <option value="friends_family">Friends &amp; Family</option>
          </select>
        </div>

        <div className="p-field">
          <label htmlFor="health_notes">Health notes</label>
          <textarea id="health_notes" name="health_notes" rows={3} placeholder="Injuries, conditions, anything to keep in mind…" />
        </div>

        <label className="p-checkbox">
          <input type="checkbox" name="marketing_consent" />
          <span>Consents to marketing emails</span>
        </label>

        <div className="p-form-actions">
          <button className="btn" type="submit">
            Send invite
          </button>
          <Link className="link-arrow" href="/portal/clients">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
