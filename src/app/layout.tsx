import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headlines and prices
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute URLs for link previews (Render sets APP_URL; locally Next falls back to localhost)
  metadataBase: process.env.APP_URL ? new URL(process.env.APP_URL) : undefined,
  title: "Gifted · Group gifts, handled",
  description:
    "Group gifts without chasing anyone for money. One prompt finds the gift, everyone reserves their share with PayPal, nobody is charged unless everyone is in.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
