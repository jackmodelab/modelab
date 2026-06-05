import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RequestResetForm } from '@/components/auth-reset-forms';
import { FlaskMark } from '@/components/flask-mark';
import { getUser, isStaffUser } from '@/lib/auth/guards';

export const metadata = { title: 'Reset password — MODE Lab' };

export default async function ForgotPasswordPage() {
  // Already signed in? No need to recover.
  if (await getUser()) {
    redirect((await isStaffUser()) ? '/portal' : '/account');
  }

  return (
    <div className="auth-card">
      <a className="brand" href="/index.html" aria-label="MODE Lab home" style={{ color: 'var(--engineered-black)' }}>
        <FlaskMark />
        <span className="mono" style={{ fontSize: '0.82rem', letterSpacing: '0.22em' }}>
          MODE&nbsp;LAB
        </span>
      </a>
      <h1>Reset your password.</h1>
      <p className="lede">Enter your email and we’ll send you a link to set a new password.</p>

      <RequestResetForm />

      <p className="auth-alt">
        Remembered it?{' '}
        <Link className="text-link" href="/login" style={{ display: 'inline-flex' }}>
          Back to sign in &rarr;
        </Link>
      </p>
    </div>
  );
}
