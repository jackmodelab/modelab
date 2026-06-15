import { Suspense } from 'react';
import { AppFrame } from '@/components/portal/app-frame';
import { Rail, type RailSection } from '@/components/portal/rail';
import { CommandPalette } from '@/components/portal/command-palette';
import { MobileTabs, type MobileTab } from '@/components/portal/mobile-tabs';
import { RouteToast } from '@/components/portal/route-toast';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getStaffNotifications } from '@/lib/notifications';
import { initials } from '@/lib/format';
import type { ClientRow } from '@/types/database';

function buildSections(notify: boolean, pendingCount: number): RailSection[] {
  return [
    {
      label: 'Workspace',
      items: [
        { href: '/portal',              label: 'Today',        icon: 'dashboard', matchExact: true },
        { href: '/portal/schedule',     label: 'Calendar',     icon: 'calendar' },
        { href: '/portal/requests',     label: 'Requests',     icon: 'bell', badge: pendingCount || null, badgeWarn: pendingCount > 0 },
        { href: '/portal/availability', label: 'Availability', icon: 'clock' },
      ],
    },
    {
      label: 'Library',
      items: [
        { href: '/portal/clients',      label: 'Clients',      icon: 'users' },
      ],
    },
    {
      label: 'Account',
      items: [
        { href: '/portal/profile',      label: 'Profile',      icon: 'user', dot: notify },
      ],
    },
  ];
}

function buildMobileTabs(notify: boolean): MobileTab[] {
  return [
    { href: '/portal',          label: 'Today',    icon: 'dashboard' },
    { href: '/portal/schedule', label: 'Calendar', icon: 'calendar' },
    { href: '/portal/clients',  label: 'Clients',  icon: 'users' },
    { href: '/portal/requests', label: 'Requests', icon: 'bell' },
    { href: '/portal/profile',  label: 'Profile',  icon: 'user', dot: notify },
  ];
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, staff } = await requireStaff();
  const email = user.email ?? '';
  const fullName = staff.display_name || email.split('@')[0] || 'Staff';

  // Lightweight active-client list powering the ⌘K command palette, plus the
  // count of pending time requests for the Requests nav badge.
  const supabase = await createSupabaseServer();
  const [{ data: clientRows }, { count: pendingCount }] = await Promise.all([
    supabase.from('clients').select('id,full_name,email').is('archived_at', null).order('full_name'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  const paletteClients = ((clientRows ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email'>[]).map((c) => ({
    id: c.id,
    name: c.full_name || c.email,
    email: c.email,
  }));

  const { count: notifyCount } = await getStaffNotifications();
  const notify = notifyCount > 0;
  const sections = buildSections(notify, pendingCount ?? 0);
  const mobileTabs = buildMobileTabs(notify);

  return (
    <AppFrame
      portal="staff"
      rail={
        <Rail
          portal="staff"
          sections={sections}
          user={{ initials: initials(staff.display_name, email), fullName, email }}
          topSlot={<CommandPalette clients={paletteClients} />}
        />
      }
      mobileTabs={<MobileTabs tabs={mobileTabs} />}
    >
      {children}
      <Suspense fallback={null}>
        <RouteToast />
      </Suspense>
    </AppFrame>
  );
}
