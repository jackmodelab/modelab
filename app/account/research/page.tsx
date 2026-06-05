import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import type { ArticleRow } from '@/types/database';

export const metadata = { title: 'Research — MODE Lab' };

export default async function ResearchPage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false });

  const articles = (data ?? []) as ArticleRow[];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">MODE Lab · Research</p>
          <h1>The Research Library.</h1>
        </div>
      </header>

      <p style={{ color: 'var(--slate)', maxWidth: '60ch', marginBottom: '2rem', fontSize: '13.5px' }}>
        Evidence, methodology and plain-English explainers from the Lab — shared with every member.
        New pieces are posted here as we publish them.
      </p>

      {articles.length === 0 ? (
        <p className="empty">No articles published yet. Check back soon.</p>
      ) : (
        <div className="svc-grid">
          {articles.map((a) => (
            <Link key={a.id} href={`/account/research/${a.slug}`} className="svc-card">
              {a.category && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--slate-soft)' }}>
                  {a.category}
                </span>
              )}
              <div className="svc-name">{a.title}</div>
              {a.excerpt && <div className="svc-blurb">{a.excerpt}</div>}
              <div className="svc-foot">
                <span className="svc-duration">{a.published_at ? formatDate(a.published_at) : ''}</span>
                <span className="svc-badge">Read →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
