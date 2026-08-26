import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book My Room — Discover Bangladesh",
  description: "Find hotels, rooms, tours and cars across Bangladesh with Book My Room.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
