import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { reportTypeLabel } from '@/lib/reports/templates';
import { Icon } from '@/components/portal/icons';
import type { ClientReportRow, ClientRow } from '@/types/database';

export const metadata = { title: 'Reports — MODE Lab' };

export default async function ReportsPage() {
  await requireStaff();
  const supabase = await createSupabaseServer();

  const [{ data: reportRows }, { data: clientRows }] = await Promise.all([
    supabase.from('client_reports').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('id,full_name,email'),
  ]);

  const reports = (reportRows ?? []) as ClientReportRow[];
  const clientName = new Map(
    ((clientRows ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email'>[]).map((c) => [c.id, c.full_name || c.email]),
  );

  const drafts = reports.filter((r) => r.status === 'draft').length;
  const shared = reports.filter((r) => r.shared_with_client).length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Reports</p>
          <h1>Reports.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn" href="/portal/reports/new">
            <Icon.plus /> New report
          </Link>
        </div>
      </header>

      <div className="stat-strip">
        <div className="stat-card">
          <div className="k">All reports</div>
          <div className="v">{reports.length}</div>
          <div className="sub">{reports.length - drafts} published</div>
        </div>
        <div className="stat-card">
          <div className="k">Drafts</div>
          <div className="v">{drafts}</div>
          <div className="sub">Not yet published</div>
        </div>
        <div className="stat-card">
          <div className="k">Shared with clients</div>
          <div className="v">{shared}</div>
          <div className="sub is-ok">Visible in member portal</div>
        </div>
      </div>

      <section className="surface" style={{ marginTop: 20 }}>
        <div className="surface-head">
          <h2>
            All reports
            <span className="count">{reports.length}</span>
          </h2>
        </div>
        <div className="surface-body">
          {reports.length === 0 ? (
            <div className="next-empty">
              <h2>No reports yet.</h2>
              <p>Build a progress, quarterly or results report for a client — display it, print it or save a PDF.</p>
              <Link className="btn" href="/portal/reports/new">
                <Icon.plus /> New report
              </Link>
            </div>
          ) : (
            reports.map((r) => (
              <Link className="row-item is-clickable" key={r.id} href={`/portal/reports/${r.id}`}>
                <div className="ri-main">
                  <div className="ri-title">{r.title}</div>
                  <div className="ri-sub">
                    {clientName.get(r.client_id) ?? 'Client'} · {reportTypeLabel(r.type)} ·{' '}
                    {format(parseISO(r.created_at), 'dd MMM yyyy')}
                  </div>
                </div>
                <div className="ri-actions">
                  {r.shared_with_client && <span className="pill pill--ok">Shared</span>}
                  <span className={`pill ${r.status === 'published' ? 'pill--dark' : ''}`}>
                    {r.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                  <Icon.chevronR className="ri-chevron" />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </>
  );
}
