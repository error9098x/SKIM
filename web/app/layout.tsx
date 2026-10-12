import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

/**
 * Theme switch for the 23:30 IST gate. '' = light paper (ship target).
 * Set to 'theme-dark' to fall back to the dark token set in app/globals.css. Nothing else changes.
 */
const THEME = 'theme-dark' as '' | 'theme-dark';

export const metadata: Metadata = {
  title: 'SKIM · Revenue-based credit for machines on peaq',
  description: 'Machines earn. Now they can borrow. SKIM advances working capital to machines against their Machine NFT and repays it by skimming on-chain revenue.',
  metadataBase: new URL('https://skim-theta.vercel.app'),
  openGraph: { type: 'website', siteName: 'SKIM', images: [{ url: '/og.png', width: 1200, height: 630, alt: 'SKIM · Machines earn. Now they can borrow.' }] },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

export const viewport: Viewport = { themeColor: THEME === 'theme-dark' ? '#0A0A0C' : '#F7F7F5', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${THEME}`.trim()}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
