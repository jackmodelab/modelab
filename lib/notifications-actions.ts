'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { NOTIF_SEEN_COOKIE } from '@/lib/notifications';

/**
 * Mark the signed-in user's notifications as seen by stamping a "last seen"
 * cookie at `now`. Called when the Profile page (where the notifications panel
 * lives) opens. Revalidating the portal/account layout recomputes the unread
 * dot so it clears immediately. Per-browser; no schema needed.
 */
export async function markNotificationsSeen(portal: 'staff' | 'member') {
  const store = await cookies();
  store.set(NOTIF_SEEN_COOKIE, new Date().toISOString(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  revalidatePath(portal === 'staff' ? '/portal' : '/account', 'layout');
}
