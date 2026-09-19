import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LoyaltyApp — loyalty & CRM for cafés',
  description:
    'Digital loyalty cards in Apple Wallet and Google Wallet, NFC and QR stamping, customer CRM and campaigns for coffee shops.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6F4E37',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
