import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Icon } from '@/components/portal/icons';
import { FileDownload } from '@/components/portal/file-download';
import type { DocumentRow, ClientRow } from '@/types/database';

export const metadata = { title: 'Files — MODE Lab' };

export default async function FilesPage({ searchParams }: { searchParams: { client?: string } }) {
  await requireStaff();
  const supabase = createSupabaseServer();
  const filterClient = searchParams.client ?? '';

  const [{ data: docs }, { data: clients }] = await Promise.all([
    filterClient
      ? supabase.from('documents').select('*').eq('client_id', filterClient).order('created_at', { ascending: false })
      : supabase.from('documents').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('id,full_name,email').order('full_name', { ascending: true }),
  ]);

  const files = (docs ?? []) as DocumentRow[];
  const clientList = (clients ?? []) as Pick<ClientRow, 'id' | 'full_name' | 'email'>[];
  const clientName = new Map(clientList.map((c) => [c.id, c.full_name || c.email]));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Staff · Files</p>
          <h1>Client files.</h1>
        </div>
        <div className="page-head-actions">
          <button className="btn" type="button" disabled title="Upload — coming soon">
            <Icon.plus /> Upload
          </button>
        </div>
      </header>

      <form method="get" className="p-form" style={{ maxWidth: 'none', flexDirection: 'row', alignItems: 'end', gap: 12, padding: 16, marginBottom: 18 }}>
        <div className="p-field" style={{ flex: 1, maxWidth: 360 }}>
          <label htmlFor="client">Filter by client</label>
          <select id="client" name="client" defaultValue={filterClient}>
            <option value="">All clients</option>
            {clientList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || c.email}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit">Apply</button>
        {filterClient && (
          <Link className="btn btn--ghost" href="/portal/files">
            Clear
          </Link>
        )}
      </form>

      <section className="surface">
        <div className="surface-head">
          <h2>
            Library
            <span className="count">{files.length} files</span>
          </h2>
        </div>
        <div className="surface-body">
          {files.length === 0 ? (
            <p className="empty">No files shared yet.</p>
          ) : (
            files.map((f) => (
              <div className="row-item" key={f.id}>
                <div className="ri-main">
                  <div className="ri-title">{f.title}</div>
                  <div className="ri-sub">
                    {clientName.get(f.client_id) ?? 'Client'} · {f.file_type ?? 'FILE'} ·{' '}
                    {format(parseISO(f.created_at), 'dd MMM yyyy')}
                  </div>
                </div>
                <div className="ri-actions">
                  <span className="pill">{f.file_type ?? 'FILE'}</span>
                  <FileDownload documentId={f.id} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <p style={{ marginTop: 14, color: 'var(--slate-soft)', fontSize: 11, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
        Upload lands in the next release. Download mints a short-lived signed URL from the Supabase Storage <code>client-files</code> bucket.
      </p>
    </>
  );
}
