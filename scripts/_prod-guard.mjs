/**
 * Refuse to run a destructive / seed script against PRODUCTION unless explicitly
 * acknowledged (F-8 / T-8).
 *
 * .env.local currently points at the PROD Supabase project (JACK-1), so a stray
 * `node scripts/seed-*.mjs` or `purge-test-users.mjs` would create/delete rows
 * in production. These scripts call assertNotProd(URL) right after they resolve
 * the Supabase URL; pass --i-understand-prod to override the guard on purpose.
 */
const PROD_REF = 'klplcfwztyrmoedvshhf'; // production Supabase project ref (public URL host)

export function assertNotProd(url) {
  const isProd = typeof url === 'string' && url.includes(PROD_REF);
  const override = process.argv.includes('--i-understand-prod');

  if (isProd && !override) {
    console.error(
      `\n✗ Refusing to run against PRODUCTION (${url}).\n` +
        `  This script targets the project configured in .env.local, which is prod.\n` +
        `  Point .env.local at a staging project, or re-run with --i-understand-prod\n` +
        `  ONLY if you genuinely mean to touch production data.\n`,
    );
    process.exit(1);
  }

  if (isProd && override) {
    console.warn('\n⚠ Running against PRODUCTION (--i-understand-prod given). Proceed carefully.\n');
  }
}
