import Link from 'next/link';
import { AppFrame } from '@/components/portal/app-frame';
import { Rail, type RailSection } from '@/components/portal/rail';
import { MobileTabs, type MobileTab } from '@/components/portal/mobile-tabs';
import { SignOutButton } from '@/components/sign-out-button';
import { requireClient } from '@/lib/auth/guards';
import { hasCompletedScreening } from '@/lib/screening/queries';
import { getMemberNotifications } from '@/lib/notifications';
import { initials } from '@/lib/format';

function buildSections(notify: boolean): RailSection[] {
  return [
    {
      label: 'Your account',
      items: [
        { href: '/account',          label: 'Home',           icon: 'home',         matchExact: true },
        { href: '/account/screening', label: 'Pre-screening', icon: 'file' },
        { href: '/account/book',     label: 'Book a session', icon: 'plus' },
        { href: '/account/bookings', label: 'My bookings',    icon: 'calendar' },
        { href: '/account/packages', label: 'Packages',       icon: 'packageIcon' },
        { href: '/account/files',    label: 'Files',          icon: 'file' },
      ],
    },
    {
      label: 'Account',
      items: [
        { href: '/account/billing',  label: 'Payments',       icon: 'card' },
        { href: '/account/profile',  label: 'Profile',        icon: 'user', dot: notify },
        { href: '/account/research', label: 'Research',       icon: 'file' },
      ],
    },
  ];
}

function buildMobileTabs(notify: boolean): MobileTab[] {
  return [
    { href: '/account',          label: 'Home',     icon: 'home' },
    { href: '/account/bookings', label: 'Sessions', icon: 'calendar' },
    { href: '/account/files',    label: 'Files',    icon: 'file' },
    { href: '/account/packages', label: 'Packs',    icon: 'packageIcon' },
    { href: '/account/profile',  label: 'Profile',  icon: 'user', dot: notify },
  ];
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, client } = await requireClient();
  const email = client?.email ?? user.email ?? '';
  const fullName = client?.full_name || email.split('@')[0] || 'Member';

  // Archived members lose portal access until staff reactivate them (which
  // emails a fresh sign-in link). Short-circuit to an honest inactive notice.
  if (client?.archived_at) {
    return (
      <div className="app" data-portal="member">
        <main className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
          <section className="surface" style={{ maxWidth: 440, textAlign: 'center' }}>
            <div className="surface-body--pad">
              <h1 style={{ fontSize: 20, marginBottom: 8 }}>Your account is inactive</h1>
              <p style={{ color: 'var(--slate)', fontSize: 14, lineHeight: 1.6 }}>
                This account has been paused by MODE Lab. Please contact the studio to reactivate it —
                we’ll email you a fresh sign-in link.
              </p>
              <div style={{ marginTop: 18 }}>
                <SignOutButton />
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const screeningDone = client ? await hasCompletedScreening(client.id) : true;
  const { count: notifyCount } = client ? await getMemberNotifications(client.id) : { count: 0 };
  const notify = notifyCount > 0;
  const sections = buildSections(notify);
  const mobileTabs = buildMobileTabs(notify);

  return (
    <AppFrame
      portal="member"
      rail={<Rail portal="member" sections={sections} user={{ initials: initials(client?.full_name, email), fullName, email }} />}
      mobileTabs={<MobileTabs tabs={mobileTabs} />}
    >
      {!screeningDone && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: '#fff8e6',
            border: '1px solid #f3e0a8',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontWeight: 650, fontSize: 14, color: '#7a5e10' }}>
              Complete your new client pre-screening
            </div>
            <div style={{ fontSize: 13, color: '#8a6d1a', marginTop: 2 }}>
              This short health questionnaire is required before you can book your first session.
            </div>
          </div>
          <Link className="btn" href="/account/screening" style={{ flexShrink: 0 }}>
            Complete now <span className="arrow">&rarr;</span>
          </Link>
        </div>
      )}
      {children}
    </AppFrame>
  );
}
