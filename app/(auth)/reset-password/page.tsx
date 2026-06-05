import Link from 'next/link';
import { SetPasswordForm } from '@/components/auth-reset-forms';
import { FlaskMark } from '@/components/flask-mark';
import { getUser } from '@/lib/auth/guards';

export const metadata = { title: 'Set a new password — MODE Lab' };

export default async function ResetPasswordPage() {
  // The recovery link is exchanged for a session by /auth/callback before
  // landing here. No session → the link was expired, already used, or opened
  // directly. Show a friendly recovery path rather than a broken form.
  const user = await getUser();

  return (
    <div className="auth-card">
      <a className="brand" href="/index.html" aria-label="MODE Lab home" style={{ color: 'var(--engineered-black)' }}>
        <FlaskMark />
        <span className="mono" style={{ fontSize: '0.82rem', letterSpacing: '0.22em' }}>
          MODE&nbsp;LAB
        </span>
      </a>
      <h1>Set a new password.</h1>

      {user ? (
        <>
          <p className="lede">Choose a new password for your account.</p>
          <SetPasswordForm />
        </>
      ) : (
        <>
          <p className="lede">This reset link has expired or already been used.</p>
          <p className="auth-alt">
            <Link className="text-link" href="/forgot-password" style={{ display: 'inline-flex' }}>
              Request a new link &rarr;
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
