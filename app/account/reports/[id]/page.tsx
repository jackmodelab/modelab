import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireClient } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getReport } from '@/lib/reports/queries';
import { ReportDocument } from '@/components/portal/report-document';
import { PrintButton } from '@/components/portal/print-button';
import type { StaffRow } from '@/types/database';

export const metadata = { title: 'Report — MODE Lab' };

export default async function MemberReportViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireClient();
  const { id } = await params;

  // RLS only returns this row if it's the member's own, published AND shared.
  const report = await getReport(id);
  if (!report || !client || report.client_id !== client.id) notFound();

  // Belt-and-braces: only ever render a PUBLISHED + SHARED report to a member.
  // RLS already enforces this, but re-checking in app code means a future RLS
  // change can't silently expose an in-progress draft (which may contain
  // unreviewed clinical interpretation) to the client.
  if (report.status !== 'published' || !report.shared_with_client) notFound();

  const supabase = await createSupabaseServer();
  const { data: staffData } = report.author_staff_id
    ? await supabase.from('staff').select('display_name').eq('id', report.author_staff_id).maybeSingle()
    : { data: null };
  const authorName = (staffData as Pick<StaffRow, 'display_name'> | null)?.display_name ?? null;
  const clientName = client.full_name || client.email;

  return (
    <>
      <header className="page-head no-print">
        <div>
          <Link className="link-arrow" href="/account/reports" style={{ marginBottom: 8 }}>
            ← Your reports
          </Link>
          <h1>Report.</h1>
        </div>
        <div className="page-head-actions">
          <PrintButton />
        </div>
      </header>

      <div className="report-page">
        <ReportDocument report={report} clientName={clientName} authorName={authorName} />
      </div>
    </>
  );
}
