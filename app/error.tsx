"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Public route rendering failed", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="route-error" role="alert">
      <span>BOOK MY ROOM</span>
      <h1>We could not load this page.</h1>
      <p>No booking or payment was changed. Try again when your connection is ready.</p>
      <button type="button" onClick={reset}>Try again</button>
    </main>
  );
}

