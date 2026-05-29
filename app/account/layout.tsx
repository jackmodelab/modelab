import { AppFrame } from '@/components/portal/app-frame';
import { Rail, type RailSection } from '@/components/portal/rail';
import { MemberTopbar } from '@/components/portal/topbar';
import { MobileTabs, type MobileTab } from '@/components/portal/mobile-tabs';
import { requireClient } from '@/lib/auth/guards';

const SECTIONS: RailSection[] = [
  {
    label: 'Your account',
    items: [
      { href: '/account',          label: 'Home',           icon: 'home',         matchExact: true },
      { href: '/account/book',     label: 'Book a session', icon: 'plus' },
      { href: '/account/bookings', label: 'My bookings',    icon: 'calendar' },
      { href: '/account/packages', label: 'Packages',       icon: 'packageIcon' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/account/profile',  label: 'Profile',        icon: 'user' },
      { href: '/account/research', label: 'Research',       icon: 'file' },
    ],
  },
];

const MOBILE_TABS: MobileTab[] = [
  { href: '/account',          label: 'Home',     icon: 'home' },
  { href: '/account/book',     label: 'Book',     icon: 'plus' },
  { href: '/account/bookings', label: 'Sessions', icon: 'calendar' },
  { href: '/account/packages', label: 'Packs',    icon: 'packageIcon' },
  { href: '/account/profile',  label: 'Profile',  icon: 'user' },
];

function initials(input: string | null | undefined, email: string) {
  const name = (input || '').trim();
  if (name) {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name[0]!.toUpperCase();
  }
  return (email[0] ?? '?').toUpperCase();
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, client } = await requireClient();
  const email = client?.email ?? user.email ?? '';
  const fullName = client?.full_name || email.split('@')[0] || 'Member';

  return (
    <AppFrame
      portal="member"
      rail={<Rail portal="member" sections={SECTIONS} user={{ initials: initials(client?.full_name, email), fullName, email }} />}
      topbar={<MemberTopbar crumb="Member portal" />}
      mobileTabs={<MobileTabs tabs={MOBILE_TABS} />}
    >
      {children}
    </AppFrame>
  );
}
