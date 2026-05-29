import Link from 'next/link';
import { FlaskMark } from '@/components/flask-mark';
import { SignOutButton } from '@/components/sign-out-button';

type NavItem = { href: string; label: string };

export function AppHeader({
  role,
  nav,
}: {
  role: 'Member' | 'Staff';
  nav: NavItem[];
}) {
  return (
    <header className="app-header">
      <div className="container header-inner">
        <Link className="brand" href={role === 'Staff' ? '/portal' : '/account'} style={{ color: 'var(--engineered-black)' }}>
          <FlaskMark />
          <span className="mono" style={{ fontSize: '0.8rem', letterSpacing: '0.2em' }}>
            MODE&nbsp;LAB
          </span>
          <span className="role-pill" style={{ marginLeft: '0.4rem' }}>
            {role}
          </span>
        </Link>

        <nav className="app-nav" aria-label="Account">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}>
              {n.label}
            </Link>
          ))}
        </nav>

        <SignOutButton />
      </div>
    </header>
  );
}
