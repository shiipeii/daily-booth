import { useState, type FormEvent } from "react";
import { createCouple, joinCouple, signOut } from "../lib/api";
import { Segmented } from "../components/Segmented";

/** after signing up: start a new booth, or join your partner's with their code */
export function PairScreen({ onPaired }: { onPaired: () => void }) {
  const [choice, setChoice] = useState<"start" | "join">("start");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (choice === "start") await createCouple(name);
      else await joinCouple(code, name);
      onPaired();
    } catch (err) {
      setError((err as Error).message.toLowerCase());
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--center">
      <div>
        <h1 className="screen__title">set up your booth</h1>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          one of you starts it, the other joins with a code.
        </p>
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Segmented
          label="start or join"
          value={choice}
          onChange={setChoice}
          options={[
            { value: "start", label: "start a booth" },
            { value: "join", label: "i have a code" },
          ]}
        />
        <label className="field">
          <span className="field__label">your name</span>
          <input className="field__input" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {choice === "join" && (
          <label className="field">
            <span className="field__label">their code</span>
            <input
              className="field__input"
              required
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button" type="submit" disabled={busy}>
          {busy ? "one sec…" : choice === "start" ? "start our booth" : "join booth"}
        </button>
        <button className="button button--quiet" type="button" onClick={signOut}>
          sign out
        </button>
      </form>
    </main>
  );
}
