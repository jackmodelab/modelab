import { Suspense } from 'react';
import { AppFrame } from '@/components/portal/app-frame';
import { Rail, type RailSection } from '@/components/portal/rail';
import { StaffTopbar } from '@/components/portal/topbar';
import { MobileTabs, type MobileTab } from '@/components/portal/mobile-tabs';
import { RouteToast } from '@/components/portal/route-toast';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { ClientRow } from '@/types/database';

function buildSections(pendingCount: number): RailSection[] {
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
        { href: '/portal/profile',      label: 'Profile',      icon: 'user' },
      ],
    },
  ];
}

const MOBILE_TABS: MobileTab[] = [
  { href: '/portal',          label: 'Today',    icon: 'dashboard' },
  { href: '/portal/schedule', label: 'Calendar', icon: 'calendar' },
  { href: '/portal/requests', label: 'Requests', icon: 'bell' },
  { href: '/portal/profile',  label: 'Profile',  icon: 'user' },
];

function initialsFor(input: string | null | undefined, email: string) {
  const name = (input || '').trim();
  if (name) {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name[0]!.toUpperCase();
  }
  return (email[0] ?? '?').toUpperCase();
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, staff } = await requireStaff();
  const email = user.email ?? '';
  const fullName = staff.display_name || email.split('@')[0] || 'Staff';

  // Lightweight client list powering the ⌘K command palette, plus the count of
  // pending time requests for the Requests nav badge.
  const supabase = await createSupabaseServer();
  const [{ data: clientRows }, { count: pendingCount }] = await Promise.all([
    supabase.from('clients').select('id,full_name,email').order('full_name'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  const paletteClients = ((clientRows ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email'>[]).map((c) => ({
    id: c.id,
    name: c.full_name || c.email,
    email: c.email,
  }));

  return (
    <AppFrame
      portal="staff"
      rail={<Rail portal="staff" sections={buildSections(pendingCount ?? 0)} user={{ initials: initialsFor(staff.display_name, email), fullName, email }} />}
      topbar={<StaffTopbar clients={paletteClients} />}
      mobileTabs={<MobileTabs tabs={MOBILE_TABS} />}
    >
      {children}
      <Suspense fallback={null}>
        <RouteToast />
      </Suspense>
    </AppFrame>
  );
}
