import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  clearStoredKey,
  fetchAccount,
  fetchHubConfig,
  loadStoredKey,
  rotateKey,
  storeKey,
  upgradeRequest,
  upgradeVerify,
  type HubAccount,
  type HubWorldSummary,
} from "@/lib/hubClient";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { showcaseButtonClassNames } from "@/components/ShowcasePrimitives";

/**
 * Public account page at arcanum-hub.com/account.
 *
 * Sign-in is "paste your key" — same model as the creator. We store
 * it in localStorage so the visitor doesn't have to paste it every
 * time on the same machine. No passwords, no OAuth; a stolen key
 * gets rotated away.
 */
export function AccountPage() {
  const [apiKey, setApiKeyState] = useState(() => loadStoredKey());
  const [account, setAccount] = useState<HubAccount | null>(null);
  const [worlds, setWorlds] = useState<HubWorldSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);

  const refresh = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAccount(apiKey);
      setAccount(res.account);
      setWorlds(res.worlds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const handleSignIn = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    storeKey(trimmed);
    setApiKeyState(trimmed);
    setInput("");
  };

  const handleSignOut = () => {
    clearStoredKey();
    setApiKeyState("");
    setAccount(null);
    setWorlds([]);
  };

  const handleRotate = async () => {
    if (!confirm("Rotate your API key? The current key will be invalidated and usage counters will reset.")) return;
    setLoading(true);
    try {
      const { apiKey: fresh } = await rotateKey(apiKey);
      storeKey(fresh);
      setApiKeyState(fresh);
      await refresh();
      alert(`New key:\n\n${fresh}\n\nCopy it somewhere safe — it replaces your old one in this browser already.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="font-display text-sm uppercase tracking-[0.2em] text-accent">
            Arcanum Hub
          </Link>
          {apiKey ? (
            <button onClick={handleSignOut} className="text-xs uppercase tracking-wider text-text-muted hover:text-text-primary">
              Sign out
            </button>
          ) : (
            <Link to="/signup" className="text-xs uppercase tracking-wider text-text-muted hover:text-text-primary">
              Create account
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {!apiKey && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
            <h1 className="font-display text-2xl uppercase tracking-[0.18em]">Sign in</h1>
            <p className="mt-2 text-sm leading-7 text-text-muted">
              Paste your Arcanum Hub API key below. It's stored in this browser so you don't have to
              paste it again on this machine.
            </p>
            <form
              className="mt-5 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                handleSignIn();
              }}
            >
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="hubk_full_..."
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent/60 focus:outline-none"
              />
              <button type="submit" className={showcaseButtonClassNames.primary} disabled={!input.trim()}>
                Sign in
              </button>
            </form>
            <p className="mt-4 text-xs text-text-muted">
              Don't have a key? <Link to="/signup" className="text-accent underline">Create one</Link>.
            </p>
          </section>
        )}

        {apiKey && loading && !account && (
          <p className="text-sm text-text-muted">Loading account…</p>
        )}

        {apiKey && error && !account && (
          <div className="rounded-xl border border-status-error/40 bg-[var(--panel)] p-6 text-sm text-status-error">
            {error}
            <div className="mt-3 flex gap-2">
              <button onClick={refresh} className={showcaseButtonClassNames.secondary}>Retry</button>
              <button onClick={handleSignOut} className={showcaseButtonClassNames.quiet}>Sign out</button>
            </div>
          </div>
        )}

        {apiKey && account && (
          <div className="space-y-6">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl uppercase tracking-[0.18em]">{account.displayName}</h1>
                  <p className="mt-1 text-xs text-text-muted">
                    {account.email ?? "no email on file"}
                    {account.emailVerified && (
                      <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                        verified
                      </span>
                    )}
                  </p>
                </div>
                <TierBadge tier={account.tier} />
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <UsageBar
                  label="Image generations"
                  used={account.usage.imagesUsed}
                  quota={account.usage.imagesQuota}
                />
                <UsageBar
                  label="Prompt calls"
                  used={account.usage.promptsUsed}
                  quota={account.usage.promptsQuota}
                />
              </div>

              {account.tier === "demo" && !showUpgrade && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-text-secondary">
                  <span>
                    Verify your email to upgrade to <strong className="text-text-primary">full tier</strong>{" "}
                    (500 images, 5000 prompts, plus publishing).
                  </span>
                  <button onClick={() => setShowUpgrade(true)} className={showcaseButtonClassNames.primary}>
                    Upgrade
                  </button>
                </div>
              )}

              {showUpgrade && (
                <UpgradePanel
                  apiKey={apiKey}
                  defaultDisplayName={account.displayName}
                  onDone={async (newKey) => {
                    storeKey(newKey);
                    setApiKeyState(newKey);
                    setShowUpgrade(false);
                    await refresh();
                  }}
                  onCancel={() => setShowUpgrade(false)}
                />
              )}

              <div className="mt-5 flex items-center justify-between gap-3 text-xs text-text-muted">
                <span>Rotating your key resets your usage counters and invalidates the old key.</span>
                <button onClick={handleRotate} disabled={loading} className={showcaseButtonClassNames.secondary}>
                  Rotate key
                </button>
              </div>
            </section>

            {worlds.length > 0 && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
                <h2 className="font-display text-sm uppercase tracking-widest text-text-primary">Your worlds</h2>
                <ul className="mt-4 divide-y divide-[var(--border)]">
                  {worlds.map((w) => (
                    <li key={w.slug} className="flex items-center justify-between py-3 text-sm">
                      <div className="min-w-0">
                        <a
                          href={`https://${w.slug}.arcanum-hub.com/`}
                          className="font-display uppercase tracking-wider text-accent hover:underline"
                        >
                          {w.displayName ?? w.slug}
                        </a>
                        <p className="text-xs text-text-muted">
                          {w.listed ? "listed" : "unlisted"}{" "}
                          {w.lastPublishAt && (
                            <>
                              · last published {new Date(w.lastPublishAt).toLocaleDateString()}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted">
                        {(w.bytesUsed / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────

function TierBadge({ tier }: { tier: HubAccount["tier"] }) {
  const style =
    tier === "demo"
      ? "border-[var(--border)] bg-[var(--bg)] text-text-muted"
      : tier === "full"
        ? "border-accent/40 bg-accent/20 text-accent"
        : "border-[var(--border)] bg-[var(--bg)] text-text-secondary";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${style}`}>
      {tier}
    </span>
  );
}

function UsageBar({ label, used, quota }: { label: string; used: number; quota: number }) {
  const pct = quota ? Math.round((used / quota) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="uppercase tracking-wider text-text-muted">{label}</span>
        <span className="font-mono text-text-secondary">{used} / {quota}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg)]">
        <div
          className={`h-full ${pct >= 90 ? "bg-status-error" : pct >= 70 ? "bg-warm" : "bg-accent"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function UpgradePanel({
  apiKey,
  defaultDisplayName,
  onDone,
  onCancel,
}: {
  apiKey: string;
  defaultDisplayName: string;
  onDone: (newKey: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [code, setCode] = useState("");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHubConfig()
      .then((c) => setTurnstileSiteKey(c.turnstileSiteKey))
      .catch(() => setTurnstileSiteKey(""));
  }, []);

  const doRequest = async () => {
    setBusy(true);
    setError(null);
    try {
      await upgradeRequest(apiKey, { email: email.trim(), displayName: displayName.trim(), turnstileToken });
      setStage("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await upgradeVerify(apiKey, { email: email.trim(), code: code.trim() });
      await onDone(res.apiKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-xl border border-accent/40 bg-[var(--bg)] p-5">
      {stage === "request" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doRequest();
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              disabled={busy}
              className={inputClasses}
            />
          </Field>
          <Field label="Display name">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={busy}
              className={inputClasses}
            />
          </Field>
          <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} onError={setError} />
          {error && <p className="text-xs text-status-error">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onCancel} className={showcaseButtonClassNames.quiet}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !email.trim() || !displayName.trim() || (Boolean(turnstileSiteKey) && !turnstileToken)}
              className={showcaseButtonClassNames.primary}
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </div>
        </form>
      )}
      {stage === "verify" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doVerify();
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-xs text-text-muted">
            We sent a code to <span className="text-text-primary">{email}</span>. Expires in 15 minutes.
          </p>
          <Field label="Code">
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
              disabled={busy}
              className={`${inputClasses} text-center font-mono tracking-[0.4em] text-lg`}
            />
          </Field>
          {error && <p className="text-xs text-status-error">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setStage("request")} className={showcaseButtonClassNames.quiet}>
              ← Back
            </button>
            <button type="submit" disabled={busy || code.length !== 6} className={showcaseButtonClassNames.primary}>
              {busy ? "Verifying…" : "Verify"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClasses =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/60 focus:outline-none";
