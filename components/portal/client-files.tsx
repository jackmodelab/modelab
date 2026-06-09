import { format, parseISO } from 'date-fns';
import { FileDownload } from '@/components/portal/file-download';
import { Icon } from '@/components/portal/icons';
import { uploadClientDocument, deleteClientDocument, getDocumentSignedUrl } from '@/lib/portal/actions';
import type { DocumentRow } from '@/types/database';

type DocItem = Pick<DocumentRow, 'id' | 'title' | 'description' | 'file_type' | 'created_at'>;

/**
 * Staff-side file sharing for one client: upload to the private `client-files`
 * bucket and list what's shared, with download (signed URL) and delete.
 */
export function ClientFiles({
  clientId,
  documents,
  uploadError,
}: {
  clientId: string;
  documents: DocItem[];
  uploadError?: 'missing' | 'size' | 'upload';
}) {
  const errorText =
    uploadError === 'size'
      ? 'That file is too large (25 MB max).'
      : uploadError === 'upload'
        ? 'Upload failed — please try again.'
        : uploadError === 'missing'
          ? 'Choose a file to share.'
          : '';

  return (
    <section className="surface" style={{ marginTop: 20 }}>
      <div className="surface-head">
        <h2>
          Files
          <span className="count">{documents.length} shared</span>
        </h2>
      </div>

      <div className="surface-body--pad">
        <form action={uploadClientDocument} className="p-form" style={{ maxWidth: 'none', gap: 12 }}>
          <input type="hidden" name="client_id" value={clientId} />
          <div className="p-form-row-2">
            <div className="p-field">
              <label htmlFor="file">File</label>
              <input id="file" name="file" type="file" required />
            </div>
            <div className="p-field">
              <label htmlFor="title">Title (optional)</label>
              <input id="title" name="title" maxLength={200} placeholder="e.g. Body composition report" />
            </div>
          </div>
          <div className="p-field">
            <label htmlFor="description">Note (optional)</label>
            <input id="description" name="description" maxLength={1000} placeholder="A short note for the client" />
          </div>
          {errorText && (
            <p className="file-download-error" role="status">{errorText}</p>
          )}
          <div className="p-form-actions">
            <button className="btn btn--mini" type="submit">
              <Icon.plus /> Share file
            </button>
            <span className="p-field-hint">Only this client can download what you share here.</span>
          </div>
        </form>
      </div>

      <div className="surface-body" style={{ borderTop: '1px solid var(--line)' }}>
        {documents.length === 0 ? (
          <p className="empty">No files shared yet.</p>
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
              <div className="ri-actions" style={{ gap: 8 }}>
                <FileDownload documentId={d.id} action={getDocumentSignedUrl} />
                <form action={deleteClientDocument}>
                  <input type="hidden" name="document_id" value={d.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <button className="btn btn--mini btn--danger" type="submit" title="Remove file" aria-label="Remove file">
                    <Icon.trash />
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
