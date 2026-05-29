import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { FlaskMark } from '@/components/flask-mark';
import { getUser, isStaffUser } from '@/lib/auth/guards';

export const metadata = { title: 'Create account — MODE Lab' };

export default async function SignupPage() {
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
      <h1>Create your account.</h1>
      <p className="lede">Track your bookings, packages, scans and shared files in one place.</p>

      <AuthForm mode="signup" />

      <p className="auth-alt">
        Already a member?{' '}
        <Link className="text-link" href="/login" style={{ display: 'inline-flex' }}>
          Sign in &rarr;
        </Link>
      </p>
    </div>
  );
}
