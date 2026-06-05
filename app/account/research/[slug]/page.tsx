import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import type { ArticleRow } from '@/types/database';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Research — MODE Lab` , description: slug };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  const article = data as ArticleRow | null;
  if (!article) notFound();

  const paragraphs = (article.body ?? '').split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <article style={{ maxWidth: '70ch' }}>
      <Link className="link-arrow" href="/account/research" style={{ marginBottom: '2rem' }}>
        ← All research
      </Link>

      <header className="page-head" style={{ marginTop: '1.5rem' }}>
        <div>
          {article.category && <p className="kicker">{article.category}</p>}
          <h1>{article.title}</h1>
          <p className="mono" style={{ color: 'var(--slate-soft)', marginTop: '1rem', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {article.published_at ? formatDate(article.published_at) : ''}
          </p>
        </div>
      </header>

      {article.excerpt && (
        <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--ink-soft)', marginBottom: '2rem' }}>
          {article.excerpt}
        </p>
      )}

      <hr style={{ height: 1, background: 'var(--line)', border: 0, marginBottom: '2rem' }} />

      {paragraphs.length === 0 ? (
        <p style={{ color: 'var(--slate)' }}>Full article coming soon.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', color: 'var(--ink-soft)', lineHeight: 1.7 }}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </article>
  );
}
