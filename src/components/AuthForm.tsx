import { useState, type FormEvent } from "react";
import { authClient } from "../lib/auth";

type Mode = "signin" | "signup" | "forgot";
type Notice = { kind: "verify" | "reset"; email: string };

const origin = () => window.location.origin;

const urlError = () => {
  const e = new URLSearchParams(window.location.search).get("error");
  if (!e) return "";
  return e.toLowerCase().includes("token")
    ? "That link is invalid or has expired. Sign in to get a new verification link."
    : "Sign-in didn't complete. Please try again.";
};

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(urlError());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0],
          callbackURL: origin(),
        });
        if (res.error) setError(res.error.message ?? "Couldn't create the account. Try again.");
        else setNotice({ kind: "verify", email });
      } else if (mode === "signin") {
        const res = await authClient.signIn.email({ email, password, callbackURL: origin() });
        if (res.error?.code === "EMAIL_NOT_VERIFIED" || res.error?.status === 403) setNotice({ kind: "verify", email });
        else if (res.error) setError(res.error.message ?? "Couldn't sign in. Check your email and password.");
      } else {
        const res = await authClient.requestPasswordReset({ email, redirectTo: `${origin()}/reset-password` });
        if (res.error) setError(res.error.message ?? "Couldn't send the email. Try again in a minute.");
        else setNotice({ kind: "reset", email });
      }
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    const res = await authClient.signIn.social({ provider: "google", callbackURL: origin(), errorCallbackURL: `${origin()}/?error=oauth` });
    if (res?.error) setError(res.error.message ?? "Google sign-in isn't available right now.");
  }

  async function resend() {
    if (!notice) return;
    setInfo("");
    const res = await authClient.sendVerificationEmail({ email: notice.email, callbackURL: origin() });
    setInfo(res.error ? "Couldn't send another email yet. Wait a minute and try again." : "Sent. It can take a minute to arrive.");
  }

  if (notice) {
    return (
      <main className="auth">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p>
            {notice.kind === "verify"
              ? <>We sent a verification link to <strong>{notice.email}</strong>. Click it to finish creating your account. The link works for 1 hour.</>
              : <>If an account exists for <strong>{notice.email}</strong>, we sent a link to reset the password. It works for 1 hour.</>}
          </p>
          <p className="muted">Nothing there? Look in spam.</p>
          {info && <p role="status">{info}</p>}
          {notice.kind === "verify" && <button className="link" onClick={resend}>Send the link again</button>}
          <button className="link" onClick={() => { setNotice(null); setInfo(""); setMode("signin"); }}>Back to sign in</button>
        </div>
      </main>
    );
  }

  const title = mode === "signin" ? "Sign in to pick up your conversations." : mode === "signup" ? "Create an account to start messaging." : "Enter your email and we'll send a reset link.";

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit}>
        <h1>HVR</h1>
        <p className="muted">{title}</p>

        {mode !== "forgot" && (
          <>
            <button type="button" className="google" onClick={google}>Continue with Google</button>
            <p className="divider"><span>or use email</span></p>
          </>
        )}

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
        {mode !== "forgot" && (
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
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>

        {mode === "signin" && <button type="button" className="link" onClick={() => switchMode("forgot")}>Forgot your password?</button>}
        <button type="button" className="link" onClick={() => switchMode(mode === "signup" ? "signin" : mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "New here? Create an account" : mode === "signup" ? "Have an account? Sign in" : "Back to sign in"}
        </button>
      </form>
    </main>
  );
}

// import { useState, type FormEvent } from "react";
// import { authClient } from "../lib/auth";

// export function AuthForm() {
//   const [mode, setMode] = useState<"signin" | "signup">("signin");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");
//   const [busy, setBusy] = useState(false);

//   async function submit(e: FormEvent) {
//     e.preventDefault();
//     setError("");
//     setBusy(true);
//     try {
//       const res =
//         mode === "signin"
//           ? await authClient.signIn.email({ email, password })
//           : await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] });
//       if (res.error) setError(res.error.message ?? "Something went wrong. Try again.");
//     } catch {
//       setError("Can't reach the server. Check that hvr-auth is running.");
//     } finally {
//       setBusy(false);
//     }
//   }

//   return (
//     <main className="auth">
//       <form className="auth-card" onSubmit={submit}>
//         <h1>HVR</h1>
//         <p className="muted">{mode === "signin" ? "Sign in to pick up your conversations." : "Create an account to start messaging."}</p>
//         {mode === "signup" && (
//           <label>
//             Display name
//             <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
//           </label>
//         )}
//         <label>
//           Email
//           <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
//         </label>
//         <label>
//           Password
//           <input
//             type="password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             autoComplete={mode === "signin" ? "current-password" : "new-password"}
//             minLength={8}
//             required
//           />
//         </label>
//         {error && <p className="error" role="alert">{error}</p>}
//         <button className="primary" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
//         <button type="button" className="link" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>
//           {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
//         </button>
//       </form>
//     </main>
//   );
// }
