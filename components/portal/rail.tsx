'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconKey } from './icons';
import { signOut } from '@/lib/auth/actions';

export type RailNavItem = {
  href: string;
  label: string;
  icon: IconKey;
  badge?: number | string | null;
  badgeWarn?: boolean;
  /** Exact path match. Otherwise a startsWith match against pathname is used (skipping the rail href itself). */
  matchExact?: boolean;
};

export type RailSection = {
  label: string;
  items: RailNavItem[];
};

export function Rail({
  portal,
  sections,
  user,
}: {
  portal: 'staff' | 'member';
  sections: RailSection[];
  user: { initials: string; fullName: string; email: string };
}) {
  const pathname = usePathname();
  const isActive = (item: RailNavItem) => {
    if (!pathname) return false;
    if (item.matchExact) return pathname === item.href;
    if (pathname === item.href) return true;
    // Avoid matching every route on the parent overview hrefs ('/portal', '/account').
    const parentRoots = portal === 'staff' ? ['/portal'] : ['/account'];
    if (parentRoots.includes(item.href)) return pathname === item.href;
    return pathname.startsWith(item.href + '/');
  };

  return (
    <aside className="rail" aria-label="Primary">
      <div className="rail-brand">
        <div className="rail-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/flask-logo.svg" alt="" aria-hidden="true" />
        </div>
        <div className="rail-brand-text">
          <span className="name">MODE LAB</span>
          <span className="sub">{portal === 'staff' ? 'Staff' : 'Member'}</span>
        </div>
      </div>

      {sections.map((sec) => (
        <div key={sec.label}>
          <div className="rail-section-label">{sec.label}</div>
          {sec.items.map((it) => {
            const IconCmp = Icon[it.icon];
            const active = isActive(it);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`rail-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <IconCmp />
                <span>{it.label}</span>
                {it.badge != null && (
                  <span className={`rail-badge ${it.badgeWarn ? 'rail-badge--warn' : ''}`}>{it.badge}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="rail-spacer" />

      <div className="rail-user">
        <div className="rail-avatar">{user.initials}</div>
        <div className="rail-user-text">
          <div className="n">{user.fullName}</div>
          <div className="e">{user.email}</div>
        </div>
        <form action={signOut}>
          <button className="rail-signout" type="submit" title="Sign out" aria-label="Sign out">
            <Icon.logout />
          </button>
        </form>
      </div>
    </aside>
  );
}
