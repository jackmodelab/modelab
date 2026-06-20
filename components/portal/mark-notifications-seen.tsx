'use client';

import { useEffect, useRef } from 'react';
import { markNotificationsSeen } from '@/lib/notifications-actions';

/**
 * Renders nothing — on mount it tells the server the user has opened their
 * notifications, which clears the unread dot. Placed on the Profile page (where
 * the notifications panel is shown), once per portal.
 */
export function MarkNotificationsSeen({ portal }: { portal: 'staff' | 'member' }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return; // guard React Strict Mode's double-invoke
    fired.current = true;
    void markNotificationsSeen(portal);
  }, [portal]);
  return null;
}
