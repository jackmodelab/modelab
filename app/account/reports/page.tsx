import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireClient } from '@/lib/auth/guards';
import { getReportsForMember } from '@/lib/reports/queries';
import { reportTypeLabel } from '@/lib/reports/templates';
import { Icon } from '@/components/portal/icons';

export const metadata = { title: 'My reports — MODE Lab' };

export default async function MemberReportsPage() {
  const { client } = await requireClient();
  const reports = client ? await getReportsForMember(client.id) : [];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Reports</p>
          <h1>Your reports.</h1>
        </div>
      </header>

      <p style={{ color: 'var(--slate)', fontSize: 13.5, lineHeight: 1.55, maxWidth: '60ch', marginBottom: 18 }}>
        Progress and review reports your coach has shared with you. Open one to read it, print it, or save it as a PDF.
      </p>

      <section className="surface">
        <div className="surface-body">
          {reports.length === 0 ? (
            <p className="empty">No reports shared yet.</p>
          ) : (
            reports.map((r) => (
              <Link className="row-item is-clickable" key={r.id} href={`/account/reports/${r.id}`}>
                <div className="ri-main">
                  <div className="ri-title">{r.title}</div>
                  <div className="ri-sub">
                    {reportTypeLabel(r.type)} ·{' '}
                    {format(parseISO(r.published_at ?? r.created_at), 'dd MMM yyyy')}
                  </div>
                </div>
                <Icon.chevronR className="ri-chevron" />
              </Link>
            ))
          )}
        </div>
      </section>
    </>
  );
}
