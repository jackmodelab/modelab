import type { MetadataRoute } from 'next';

// Keep the authenticated surfaces and API out of search indexes; allow the
// marketing pages (served as static /public/*.html). Pairs with
// `poweredByHeader: false` in next.config.mjs (F-6 / T-6).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/portal', '/api', '/auth'],
    },
  };
}
