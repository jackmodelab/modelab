import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getReport } from '@/lib/reports/queries';
import { updateReport } from '@/lib/reports/actions';
import { ReportBuilder } from '@/components/portal/report-builder';
import type { ClientRow } from '@/types/database';

export const metadata = { title: 'Edit report — MODE Lab' };

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const supabase = await createSupabaseServer();
  const { data: clientData } = await supabase
    .from('clients')
    .select('id,full_name,email')
    .eq('id', report.client_id)
    .maybeSingle();
  const client = clientData as Pick<ClientRow, 'id' | 'full_name' | 'email'> | null;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Edit report</p>
          <h1>Edit report.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--ghost" href={`/portal/reports/${report.id}`}>
            ← Back to report
          </Link>
        </div>
      </header>

      <ReportBuilder
        action={updateReport}
        reportId={report.id}
        preselectedClient={client ? { id: client.id, name: client.full_name || client.email } : undefined}
        defaults={{
          client_id: report.client_id,
          type: report.type,
          title: report.title,
          period_start: report.period_start,
          period_end: report.period_end,
          summary: report.summary,
          content: report.content,
        }}
        cancelHref={`/portal/reports/${report.id}`}
        submitLabel="Save changes"
      />
    </>
  );
}
