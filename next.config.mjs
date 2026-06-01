const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Report-only first so it can't break the static /public/*.html pages, Google
  // Fonts, Supabase, or Google OAuth. Watch the browser console for violations,
  // tighten, then rename the key to 'Content-Security-Policy' to enforce.
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // tighten with a nonce later
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co https://oauth2.googleapis.com https://www.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
