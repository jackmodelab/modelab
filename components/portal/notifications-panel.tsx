import Link from 'next/link';
import { Icon } from '@/components/portal/icons';
import type { NotificationItem } from '@/lib/notifications';

/** Notifications surface shown on the Profile page (both portals). */
export function NotificationsPanel({ items }: { items: NotificationItem[] }) {
  return (
    <section className="surface">
      <div className="surface-head">
        <h2>
          Notifications
          {items.length > 0 && <span className="count">{items.length}</span>}
        </h2>
        <span className="icon-btn" aria-hidden="true">
          <Icon.bell />
          {items.length > 0 && <span className="dot" />}
        </span>
      </div>
      <div className="surface-body">
        {items.length === 0 ? (
          <p className="empty">You’re all caught up.</p>
        ) : (
          items.map((n) =>
            n.href ? (
              <Link className="row-item is-clickable" key={n.id} href={n.href}>
                <div className="ri-main">
                  <div className="ri-title">{n.title}</div>
                  <div className="ri-sub">{n.detail}</div>
                </div>
                <Icon.arrowR />
              </Link>
            ) : (
              <div className="row-item" key={n.id}>
                <div className="ri-main">
                  <div className="ri-title">{n.title}</div>
                  <div className="ri-sub">{n.detail}</div>
                </div>
              </div>
            ),
          )
        )}
      </div>
    </section>
  );
}
