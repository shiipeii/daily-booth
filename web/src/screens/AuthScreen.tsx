import { useState, type FormEvent } from "react";
import { signIn, signUp } from "../lib/api";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (err) {
      setError((err as Error).message.toLowerCase());
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--center">
      <div>
        <h1 className="screen__title">daily booth</h1>
        <p className="muted" style={{ margin: "8px 0 0" }}>one photo a day, together or apart.</p>
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <label className="field">
          <span className="field__label">email</span>
          <input className="field__input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">password</span>
          <input
            className="field__input"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button" type="submit" disabled={busy}>
          {busy ? "one sec…" : mode === "signup" ? "create account" : "sign in"}
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
        >
          {mode === "signup" ? "already have an account? sign in" : "new here? create an account"}
        </button>
      </form>
    </main>
  );
}
