import Link from 'next/link';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { createReport } from '@/lib/reports/actions';
import { ReportBuilder } from '@/components/portal/report-builder';
import type { ClientRow } from '@/types/database';

export const metadata = { title: 'New report — MODE Lab' };

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireStaff();
  const { client: clientId } = await searchParams;
  const supabase = await createSupabaseServer();

  const { data: clientRows } = await supabase
    .from('clients')
    .select('id,full_name,email')
    .is('archived_at', null)
    .order('full_name');

  const clients = ((clientRows ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email'>[]).map((c) => ({
    id: c.id,
    name: c.full_name || c.email,
  }));

  const preselected = clientId ? clients.find((c) => c.id === clientId) : undefined;
  const cancelHref = preselected ? `/portal/clients/${preselected.id}` : '/portal/reports';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · New report</p>
          <h1>Build a report.</h1>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--ghost" href={cancelHref}>
            ← Back
          </Link>
        </div>
      </header>

      <p style={{ color: 'var(--slate)', maxWidth: '62ch', marginBottom: '1.5rem', fontSize: '13.5px', lineHeight: 1.55 }}>
        Choose a type to start from a template, then edit the sections. Reports save as a private draft — you
        publish and (optionally) share them with the client afterwards.
      </p>

      <ReportBuilder
        action={createReport}
        clients={clients}
        preselectedClient={preselected}
        cancelHref={cancelHref}
        submitLabel="Save draft"
      />
    </>
  );
}
