import Link from 'next/link';
import { requireStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/portal/actions';

export const metadata = { title: 'Add client — MODE Lab' };

const ERRORS: Record<string, string> = {
  email: 'Enter a valid email address.',
  dupe: 'A client with that email already exists.',
  '1': 'Couldn’t add that client — please check the details and try again.',
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
          <p className="kicker">MODE Lab · Staff · New client</p>
          <h1>Add a client.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--ghost" href="/portal/clients">
            ← Clients
          </Link>
        </div>
      </header>

      <p style={{ color: 'var(--slate)', maxWidth: '60ch', marginBottom: '1.5rem', fontSize: '13.5px', lineHeight: 1.55 }}>
        Adds a bookable client record. They won’t get a portal login from here —
        you can invite them later. Only an email is required.
      </p>

      {message && (
        <div className="p-form-banner" role="alert">
          {message}
        </div>
      )}

      <form action={createClient} className="p-form">
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
            Add client
          </button>
          <Link className="link-arrow" href="/portal/clients">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
