'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconKey } from './icons';

export type MobileTab = {
  href: string;
  label: string;
  icon: IconKey;
};

/**
 * Fixed bottom tab bar that appears below 880px (client portal).
 * Active match: exact, or pathname.startsWith(href + '/') so sub-routes stay highlighted.
 */
export function MobileTabs({ tabs }: { tabs: MobileTab[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href === '/account') return pathname === '/account';
    return pathname.startsWith(href + '/');
  };
  return (
    <nav className="mobile-tabs" aria-label="Primary mobile">
      {tabs.map((t) => {
        const IconCmp = Icon[t.icon];
        const active = isActive(t.href);
        return (
          <Link key={t.href} href={t.href} className={`mobile-tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
            <IconCmp />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
