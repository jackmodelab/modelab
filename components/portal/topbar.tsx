import Link from 'next/link';
import { Icon } from './icons';
import { CommandPalette, type PaletteClient } from './command-palette';

/**
 * Staff topbar — ⌘K command palette + bell + new-booking quick action.
 */
export function StaffTopbar({
  newBookingHref = '/portal/bookings/new',
  clients = [],
}: {
  newBookingHref?: string;
  clients?: PaletteClient[];
}) {
  return (
    <div className="topbar">
      <CommandPalette clients={clients} />
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
