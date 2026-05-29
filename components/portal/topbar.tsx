import Link from 'next/link';
import { Icon } from './icons';

/**
 * Staff topbar — search pill + bell + new-booking quick action.
 * The search pill is non-interactive for now (command palette lands later).
 */
export function StaffTopbar({ newBookingHref = '/portal/bookings/new' }: { newBookingHref?: string }) {
  return (
    <div className="topbar">
      <button className="search-pill" type="button" disabled aria-label="Search (coming soon)">
        <Icon.search />
        <span>Search clients, bookings, files…</span>
        <span className="kbd">⌘ K</span>
      </button>
      <div className="topbar-right">
        <button className="icon-btn" type="button" title="Notifications" aria-label="Notifications">
          <Icon.bell />
        </button>
        <Link className="quick-add" href={newBookingHref}>
          <Icon.plus />
          <span>New booking</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Member topbar — crumb + bell. Bell shows an unread dot when there's a billing nudge.
 */
export function MemberTopbar({
  crumb,
  hasNotification = false,
}: {
  crumb: string;
  hasNotification?: boolean;
}) {
  return (
    <div className="topbar">
      <div className="topbar-crumb">
        <b>MODE Lab</b>
        <span className="sep">/</span>
        {crumb}
      </div>
      <div className="topbar-right">
        <button className="icon-btn" type="button" title="Notifications" aria-label="Notifications">
          <Icon.bell />
          {hasNotification && <span className="dot" />}
        </button>
      </div>
    </div>
  );
}
