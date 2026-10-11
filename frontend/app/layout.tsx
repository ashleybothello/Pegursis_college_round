import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/app-shell';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Credence — Finance you can prove',
  description: 'A verifiable finance dashboard for private credit decisions and settlement workflows.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${mono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" toastOptions={{ className: 'font-sans' }} />
      </body>
    </html>
  );
}
