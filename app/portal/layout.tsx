import { AppFrame } from '@/components/portal/app-frame';
import { Rail, type RailSection } from '@/components/portal/rail';
import { StaffTopbar } from '@/components/portal/topbar';
import { requireStaff } from '@/lib/auth/guards';

const SECTIONS: RailSection[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/portal',              label: 'Today',        icon: 'dashboard', matchExact: true },
      { href: '/portal/schedule',     label: 'Calendar',     icon: 'calendar' },
      { href: '/portal/availability', label: 'Availability', icon: 'clock' },
    ],
  },
  {
    label: 'Library',
    items: [
      { href: '/portal/clients',      label: 'Clients',      icon: 'users' },
      { href: '/portal/files',        label: 'Files',        icon: 'file' },
    ],
  },
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

  return (
    <AppFrame
      portal="staff"
      rail={<Rail portal="staff" sections={SECTIONS} user={{ initials: initialsFor(staff.display_name, email), fullName, email }} />}
      topbar={<StaffTopbar />}
    >
      {children}
    </AppFrame>
  );
}
