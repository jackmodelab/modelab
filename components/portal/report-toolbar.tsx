'use client';

import Link from 'next/link';
import { Icon } from '@/components/portal/icons';
import { setReportStatus, setReportShare, deleteReport } from '@/lib/reports/actions';

/**
 * Action bar on the staff report view. Print is client-side (window.print()
 * against the print stylesheet); publish / share / delete are server actions.
 * The bar itself is hidden when printing (.no-print).
 */
export function ReportToolbar({
  reportId,
  clientId,
  status,
  shared,
  editHref,
}: {
  reportId: string;
  clientId: string;
  status: 'draft' | 'published';
  shared: boolean;
  editHref: string;
}) {
  const published = status === 'published';

  return (
    <div className="report-toolbar no-print">
      <button type="button" className="btn btn--mini btn--ghost" onClick={() => window.print()}>
        <Icon.download /> Print / PDF
      </button>

      <Link className="btn btn--mini btn--ghost" href={editHref}>
        <Icon.edit /> Edit
      </Link>

      <form action={setReportStatus}>
        <input type="hidden" name="id" value={reportId} />
        <input type="hidden" name="status" value={published ? 'draft' : 'published'} />
        <button type="submit" className={`btn btn--mini ${published ? 'btn--ghost' : ''}`}>
          {published ? 'Return to draft' : 'Publish'}
        </button>
      </form>

      <form action={setReportShare}>
        <input type="hidden" name="id" value={reportId} />
        <input type="hidden" name="shared" value={shared ? 'false' : 'true'} />
        <button type="submit" className={`btn btn--mini ${shared ? 'btn--ghost' : 'btn--accent'}`}>
          {shared ? (
            <>
              <Icon.check /> Shared — unshare
            </>
          ) : (
            'Share with client'
          )}
        </button>
      </form>

      <form
        action={deleteReport}
        onSubmit={(e) => {
          if (!window.confirm('Delete this report permanently? This cannot be undone.')) e.preventDefault();
        }}
        style={{ marginLeft: 'auto' }}
      >
        <input type="hidden" name="id" value={reportId} />
        <input type="hidden" name="client_id" value={clientId} />
        <button type="submit" className="btn btn--mini btn--danger" title="Delete report" aria-label="Delete report">
          <Icon.trash />
        </button>
      </form>
    </div>
  );
}
