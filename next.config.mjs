// Next.js dev mode (HMR / React Refresh) relies on eval; production builds don't.
// Allow 'unsafe-eval' only in development so the enforced CSP doesn't break the
// dev server while staying strict in production.
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is still required: Next injects inline hydration scripts and
  // there is no per-request nonce path for the static /public/*.html pages, which
  // share this header. The static pages themselves carry no inline scripts.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://oauth2.googleapis.com https://www.googleapis.com",
  // Google Maps embed iframe on /locations.html.
  "frame-src https://maps.google.com https://www.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Belt-and-braces with Vercel's edge HSTS. Only honoured over HTTPS, so it's a
  // no-op on localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Enforced (was Report-Only). Sources audited against the app + static pages:
  // Google Fonts, Supabase, Google OAuth APIs, and the Maps embed.
  { key: 'Content-Security-Policy', value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in the `x-powered-by` response header (F-6 / T-6).
  poweredByHeader: false,
  // Pin the workspace root: a stray lockfile in the user's home dir made Next 16
  // infer the wrong root, which broke output-file tracing / page collection.
  turbopack: { root: import.meta.dirname },
  async redirects() {
    return [
      // Marketing pages still live as static files in /public during the
      // gradual port to React. Send the bare root to the static home.
      { source: '/', destination: '/index.html', permanent: false },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
