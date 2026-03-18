import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Git Kata',
  description: 'Practice Git commands through structured exercises',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="matrix-theme">{children}</body>
    </html>
  );
}
