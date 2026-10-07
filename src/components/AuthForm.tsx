import { useState, type FormEvent } from "react";
import { authClient } from "../lib/auth";

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res =
        mode === "signin"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] });
      if (res.error) setError(res.error.message ?? "Something went wrong. Try again.");
    } catch {
      setError("Can't reach the server. Check that hvr-auth is running.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit}>
        <h1>HVR</h1>
        <p className="muted">{mode === "signin" ? "Sign in to pick up your conversations." : "Create an account to start messaging."}</p>
        {mode === "signup" && (
          <label>
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
