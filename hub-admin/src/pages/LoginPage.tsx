import { useState, type FormEvent } from "react";
import { listUsers, ApiError } from "../lib/api";

interface LoginPageProps {
  onLogin: (key: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await listUsers(key);
      onLogin(key);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "Invalid admin key" : err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Arcanum Hub · Admin</h1>
      <p className="muted">Enter your master key to manage users and worlds.</p>
      <div className="panel" style={{ maxWidth: "min(480px, 100%)" }}>
        <form onSubmit={handleSubmit}>
          {error && <div className="banner error">{error}</div>}
          <div className="field">
            <label htmlFor="admin-key">Admin key</label>
            <input
              id="admin-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
              placeholder="HUB_ADMIN_KEY secret"
              disabled={busy}
            />
          </div>
          <button type="submit" className="primary" disabled={busy || !key}>
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
    </>
  );
}
