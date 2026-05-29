import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MODE Lab — Members',
  description: 'MODE Lab member and staff portal. Medical Grade Fitness.',
  icons: { icon: '/assets/img/flask.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;650;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
