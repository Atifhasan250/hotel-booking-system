import type { Metadata } from "next";
import Link from "next/link";

import { AuthPanel } from "./auth-panel";

export const metadata: Metadata = {
  title: "Sign in | Book My Room",
  description: "Secure access to your Book My Room account.",
  robots: { index: false, follow: false },
};

export default function AuthPage() {
  return (
    <main className="auth-shell">
      <Link className="auth-brand" href="/" aria-label="Book My Room home">Book My Room</Link>
      <section className="auth-intro" aria-labelledby="auth-heading">
        <span className="section-kicker light">Secure account access</span>
        <h1 id="auth-heading">Your Bangladesh stays, kept in one place.</h1>
        <p>Sign in as a customer or an authorized marketplace partner. Access is checked on the server for every protected action.</p>
      </section>
      <AuthPanel />
    </main>
  );
}
