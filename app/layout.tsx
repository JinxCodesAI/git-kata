import type { Metadata } from 'next';
import './globals.css';
import '@/lib/startup'; // Initialize container pool on startup
import { KeyboardShortcutsProvider } from '@/app/context/KeyboardShortcutsContext';
import KeyboardShortcutsLegend from '@/app/components/shortcuts/KeyboardShortcutsLegend';

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
      <body className="matrix-theme">
        <KeyboardShortcutsProvider>
          {children}
          <KeyboardShortcutsLegend />
        </KeyboardShortcutsProvider>
      </body>
    </html>
  );
}
