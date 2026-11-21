import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'HUMANIE — Intelligence for Humanity',
  description:
    'Accountable multi-domain humanitarian and social protection case management, Equity LP resource matching, Decision Vault, and Integrity Shield across Food, Work, and Education.',
  openGraph: {
    title: 'HUMANIE — Intelligence for Humanity',
    description:
      'Helping organisations reach the right people, with humans accountable for every decision. Need → Match → Human Review → Delivery → Result Check → Evidence → Integrity.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HUMANIE — Intelligence for Humanity',
    description:
      'Helping organisations reach the right people, with humans accountable for every decision.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${ibmPlexMono.variable}`}>
      <body
        suppressHydrationWarning
        className="bg-slate-50 text-slate-900 antialiased font-sans selection:bg-emerald-600 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
