import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AuthPanel } from "./auth-panel";

export const metadata: Metadata = {
  title: "Sign in | Book My Room",
  description: "Access your Book My Room account.",
  robots: { index: false, follow: false },
};

export default function AuthPage() {
  return (
    <main className="auth-shell">
      <Link className="auth-brand" href="/" aria-label="Back to Book My Room home"><ArrowLeft size={20} aria-hidden="true" /> Book My Room</Link>
      <section className="auth-intro" aria-labelledby="auth-heading">
        <h1 id="auth-heading">Your Bangladesh stays, kept in one place.</h1>
      </section>
      <AuthPanel />
    </main>
  );
}
