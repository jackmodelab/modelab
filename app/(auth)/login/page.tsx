import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { FlaskMark } from '@/components/flask-mark';
import { getUser, isStaffUser } from '@/lib/auth/guards';

export const metadata = { title: 'Sign in — MODE Lab' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in? Send them on.
  if (await getUser()) {
    redirect((await isStaffUser()) ? '/portal' : '/account');
  }
  const { next } = await searchParams;

  return (
    <div className="auth-card">
      <a className="brand" href="/index.html" aria-label="MODE Lab home" style={{ color: 'var(--engineered-black)' }}>
        <FlaskMark />
        <span className="mono" style={{ fontSize: '0.82rem', letterSpacing: '0.22em' }}>
          MODE&nbsp;LAB
        </span>
      </a>
      <h1>Welcome back.</h1>
      <p className="lede">Sign in to your member account.</p>

      <AuthForm mode="login" next={next} />

      <p className="auth-alt">
        New here?{' '}
        <Link className="text-link" href="/signup" style={{ display: 'inline-flex' }}>
          Create an account &rarr;
        </Link>
      </p>

      <div className="auth-hint">
        <strong>TEST ACCOUNTS</strong> (after running the seed)
        <br />
        Member &nbsp;→ client@modelab.test
        <br />
        Staff &nbsp;&nbsp;&nbsp;→ jack@modelab.test
        <br />
        Password → ModeLab!2026
      </div>
    </div>
  );
}
