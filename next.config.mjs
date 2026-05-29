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
};

export default nextConfig;
