"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register" | "recover" | "verify" | "reset";

const modeCopy: Record<AuthMode, { title: string; submit: string }> = {
  login: { title: "Welcome back", submit: "Sign in securely" },
  register: { title: "Create your account", submit: "Create account" },
  recover: { title: "Recover access", submit: "Request recovery" },
  verify: { title: "Verify your contact", submit: "Verify contact" },
  reset: { title: "Choose a new password", submit: "Reset password" },
};

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error?.message ?? "We could not complete that request.");
        return;
      }
      if (mode === "login") {
        router.push("/");
        router.refresh();
        return;
      }
      const successMessages: Record<Exclude<AuthMode, "login">, string> = {
        register: "Account accepted. Verification delivery is queued for provider setup.",
        recover: "If the account is eligible, recovery has been queued.",
        verify: "Contact verified. You can now sign in.",
        reset: "Password updated. Existing sessions have been revoked.",
      };
      setMessage(successMessages[mode]);
      form.reset();
    } catch {
      setMessage("The secure account service is unavailable. Please try again later.");
    } finally {
      setPending(false);
    }
  }

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
  }

  const copy = modeCopy[mode];
  const needsEmail = mode === "login" || mode === "register" || mode === "recover";
  const needsPassword = mode === "login" || mode === "register" || mode === "reset";
  const needsToken = mode === "verify" || mode === "reset";

  return (
    <section className="auth-card" aria-labelledby="auth-form-title">
      <div className="auth-mode-tabs" aria-label="Account action">
        <button type="button" aria-pressed={mode === "login"} onClick={() => selectMode("login")}>Sign in</button>
        <button type="button" aria-pressed={mode === "register"} onClick={() => selectMode("register")}>Register</button>
      </div>
      <h2 id="auth-form-title">{copy.title}</h2>
      <p className="auth-note">Private account routes are not indexed or shared across users.</p>
      <form onSubmit={submit}>
        {mode === "register" && (
          <label>Full name<input name="displayName" autoComplete="name" minLength={2} maxLength={100} required /></label>
        )}
        {needsEmail && (
          <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        )}
        {needsToken && (
          <label>Secure token<input name="token" autoComplete="one-time-code" minLength={32} maxLength={512} required /></label>
        )}
        {needsPassword && (
          <label>
            {mode === "reset" ? "New password" : "Password"}
            <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 12} maxLength={128} required />
          </label>
        )}
        {mode !== "login" && needsPassword && <p className="password-help">Use 12+ characters with upper and lowercase letters, a number, and a symbol.</p>}
        <button className="auth-submit" disabled={pending} type="submit">{pending ? "Working…" : copy.submit}</button>
        <p className="auth-status" aria-live="polite">{message}</p>
      </form>
      <div className="auth-secondary">
        {mode === "login" && <button type="button" onClick={() => selectMode("recover")}>Forgot password?</button>}
        {mode === "recover" && <button type="button" onClick={() => selectMode("reset")}>I have a recovery token</button>}
        {mode === "register" && <button type="button" onClick={() => selectMode("verify")}>I have a verification token</button>}
        {(mode === "recover" || mode === "reset" || mode === "verify") && <button type="button" onClick={() => selectMode("login")}>Back to sign in</button>}
      </div>
    </section>
  );
}
