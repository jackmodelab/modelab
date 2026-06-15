import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getReport } from '@/lib/reports/queries';
import { ReportDocument } from '@/components/portal/report-document';
import { ReportToolbar } from '@/components/portal/report-toolbar';
import type { ClientRow, StaffRow } from '@/types/database';

export const metadata = { title: 'Report — MODE Lab' };

export default async function StaffReportViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const supabase = await createSupabaseServer();
  const [{ data: clientData }, { data: staffData }] = await Promise.all([
    supabase.from('clients').select('id,full_name,email').eq('id', report.client_id).maybeSingle(),
    report.author_staff_id
      ? supabase.from('staff').select('display_name').eq('id', report.author_staff_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const client = clientData as Pick<ClientRow, 'id' | 'full_name' | 'email'> | null;
  const clientName = client?.full_name || client?.email || 'Client';
  const authorName = (staffData as Pick<StaffRow, 'display_name'> | null)?.display_name ?? null;

  return (
    <>
      <header className="page-head no-print">
        <div>
          <Link className="link-arrow" href={`/portal/clients/${report.client_id}`} style={{ marginBottom: 8 }}>
            ← {clientName}
          </Link>
          <h1>Report.</h1>
        </div>
      </header>

      <ReportToolbar
        reportId={report.id}
        clientId={report.client_id}
        status={report.status}
        shared={report.shared_with_client}
        editHref={`/portal/reports/${report.id}/edit`}
      />

      {report.status === 'draft' && (
        <div className="report-banner no-print">
          This is a <strong>draft</strong> — only staff can see it. Publish and share it to make it visible in the
          client&apos;s portal.
        </div>
      )}

      <div className="report-page">
        <ReportDocument report={report} clientName={clientName} authorName={authorName} />
      </div>
    </>
  );
}
