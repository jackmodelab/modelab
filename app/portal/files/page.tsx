import { requireStaff } from '@/lib/auth/guards';

export const metadata = { title: 'Files — MODE Lab' };

/**
 * Client file sharing is not part of the launch. The private `client-files`
 * Storage bucket, its access policies, and the client download path don't exist
 * yet, so the feature is hidden everywhere (nav, command palette, client detail)
 * and this route shows an honest placeholder rather than a list of seeded
 * placeholder documents with download buttons that would fail.
 *
 * To ship it later: create the private bucket + Storage RLS (client reads only
 * their own documents, staff read/write all), a client-scoped signed-URL
 * download action, and staff upload — then restore the library UI here.
 */
export default async function FilesPage() {
  await requireStaff();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff</p>
          <h1>Client files.</h1>
        </div>
      </header>

      <section className="surface">
        <div className="surface-body">
          <div className="empty" style={{ padding: '48px 24px' }}>
            Secure file sharing isn’t available yet. It’s coming in a future release.
          </div>
        </div>
      </section>
    </>
  );
}
