import { format, parseISO } from 'date-fns';
import { requireActiveClient } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { FileDownload } from '@/components/portal/file-download';
import { getMyDocumentSignedUrl } from '@/lib/account/actions';
import type { DocumentRow } from '@/types/database';

export const metadata = { title: 'Files — MODE Lab' };

export default async function MemberFilesPage() {
  // requireActiveClient (not requireClient): an archived member has had portal
  // access revoked, so they must not be able to list shared medical-file titles
  // either. This matches getMyDocumentSignedUrl, which already requires an active
  // client before minting a download URL. Archived/identity-less callers are
  // redirected to /account, where the layout shows the "inactive" notice.
  const { client } = await requireActiveClient();

  if (!client) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="kicker">MODE Lab · Member</p>
            <h1>Your files.</h1>
          </div>
        </header>
        <p className="empty">Setting up your profile.</p>
      </>
    );
  }

  const supabase = await createSupabaseServer();
  const { data: docs } = await supabase
    .from('documents')
    .select('id,title,description,file_type,created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false });

  const documents = (docs ?? []) as Pick<DocumentRow, 'id' | 'title' | 'description' | 'file_type' | 'created_at'>[];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Member</p>
          <h1>Your files.</h1>
        </div>
      </header>

      <section className="surface">
        <div className="surface-head">
          <h2>
            Shared with you
            <span className="count">{documents.length}</span>
          </h2>
        </div>
        <div className="surface-body">
          {documents.length === 0 ? (
            <p className="empty">Your coach hasn’t shared any files yet.</p>
          ) : (
            documents.map((d) => (
              <div className="row-item" key={d.id}>
                <div className="ri-main">
                  <div className="ri-title">{d.title}</div>
                  <div className="ri-sub">
                    {d.description ? `${d.description} · ` : ''}
                    {format(parseISO(d.created_at), 'dd MMM yyyy')}
                  </div>
                </div>
                <div className="ri-actions">
                  <FileDownload documentId={d.id} action={getMyDocumentSignedUrl} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
