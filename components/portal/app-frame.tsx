import type { ReactNode } from 'react';

/**
 * App-shell wrapper: two-column grid with sidebar rail on desktop,
 * single-column on mobile (rail hides, mobile tab bar takes over).
 * Sets `data-portal` so the design tokens pick the right palette.
 */
export function AppFrame({
  portal,
  rail,
  topbar,
  mobileTabs,
  children,
}: {
  portal: 'staff' | 'member';
  rail: ReactNode;
  topbar: ReactNode;
  mobileTabs?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app" data-portal={portal}>
      {rail}
      <div className="main">
        {topbar}
        <main className="page">{children}</main>
      </div>
      {mobileTabs}
    </div>
  );
}
