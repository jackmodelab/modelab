'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconKey } from './icons';

export type RailNavItem = {
  href: string;
  label: string;
  icon: IconKey;
  badge?: number | string | null;
  badgeWarn?: boolean;
  /** Show a small red notification dot on the icon. */
  dot?: boolean;
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
  topSlot,
}: {
  portal: 'staff' | 'member';
  sections: RailSection[];
  user: { initials: string; fullName: string; email: string };
  /** Optional content rendered under the brand (e.g. the ⌘K command palette). */
  topSlot?: ReactNode;
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

      {topSlot ? <div className="rail-top-slot">{topSlot}</div> : null}

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
                <span className="rail-icon">
                  <IconCmp />
                  {it.dot && <span className="rail-dot" aria-label="Unread notifications" />}
                </span>
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

      <Link className="rail-user" href={portal === 'staff' ? '/portal/profile' : '/account/profile'}>
        <div className="rail-avatar">{user.initials}</div>
        <div className="rail-user-text">
          <div className="n">{user.fullName}</div>
          <div className="e">{user.email}</div>
        </div>
      </Link>
    </aside>
  );
}
