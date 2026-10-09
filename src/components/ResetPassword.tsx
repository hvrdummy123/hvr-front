import { useState, type FormEvent } from "react";
import { authClient } from "../lib/auth";

export function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const linkBad = !token || params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      const res = await authClient.resetPassword({ newPassword: password, token: token! });
      if (res.error) setError(res.error.message ?? "That link is invalid or has expired. Request a new one.");
      else setDone(true);
    } catch {
      setError("Can't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const toSignIn = () => window.location.assign("/");

  if (linkBad) {
    return (
      <main className="auth">
        <div className="auth-card">
          <h1>Link expired</h1>
          <p className="muted">This reset link is invalid or has expired. Reset links work for 1 hour and only once.</p>
          <button className="primary" onClick={toSignIn}>Request a new link</button>
        </div>
      </main>
    );
  }
  if (done) {
    return (
      <main className="auth">
        <div className="auth-card">
          <h1>Password updated</h1>
          <p className="muted">You've been signed out everywhere. Sign in with your new password.</p>
          <button className="primary" onClick={toSignIn}>Go to sign in</button>
        </div>
      </main>
    );
  }
  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit}>
        <h1>New password</h1>
        <p className="muted">Choose a password with at least 8 characters.</p>
        <label>
          New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} autoComplete="new-password" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Please wait…" : "Update password"}</button>
      </form>
    </main>
  );
}