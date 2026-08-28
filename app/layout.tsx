import type { Metadata } from "next";
import "./globals.css";

const canonicalProduction = process.env.NODE_ENV === "production" && process.env.APP_ORIGIN === "https://bookmyroom.site";

export const metadata: Metadata = {
  metadataBase: new URL("https://bookmyroom.site"),
  title: "Book My Room — Stays across Bangladesh",
  description: "Discover approved hotels, resorts, eco resorts, homestays, cottages and villas across Bangladesh.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_BD",
    siteName: "Book My Room",
    url: "/",
    title: "Book My Room — Stays across Bangladesh",
    description: "Discover approved stays across Bangladesh.",
  },
  twitter: { card: "summary", title: "Book My Room", description: "Discover approved stays across Bangladesh." },
  icons: {
    icon: "/bookmyroom-dark-no-bg.png",
    shortcut: "/bookmyroom-dark-no-bg.png",
    apple: "/bookmyroom-dark-no-bg.png",
  },
  robots: canonicalProduction ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
