import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchHubConfig,
  signupDemo,
  signupRequest,
  signupVerify,
  storeKey,
} from "@/lib/hubClient";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { showcaseButtonClassNames } from "@/components/ShowcasePrimitives";

type Mode = "choose" | "demo" | "fullRequest" | "fullVerify" | "done";

/**
 * Public signup page served at arcanum-hub.com/signup. Same three
 * paths as the creator onboarding — kept in sync intentionally.
 * The final "done" state shows the API key once, with instructions
 * on how to drop it into the Arcanum creator app.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("choose");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  useEffect(() => {
    fetchHubConfig()
      .then((c) => setTurnstileSiteKey(c.turnstileSiteKey))
      .catch(() => setTurnstileSiteKey(""));
  }, []);

  const doDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await signupDemo({ displayName: displayName.trim() || undefined, turnstileToken });
      storeKey(res.apiKey);
      setApiKey(res.apiKey);
      setMode("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doFullRequest = async () => {
    setBusy(true);
    setError(null);
    try {
      await signupRequest({ email: email.trim(), displayName: displayName.trim(), turnstileToken });
      setMode("fullVerify");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doFullVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await signupVerify({ email: email.trim(), code: code.trim() });
      storeKey(res.apiKey);
      setApiKey(res.apiKey);
      setMode("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="font-display text-sm uppercase tracking-[0.2em] text-accent">
            Arcanum Hub
          </Link>
          <Link to="/account" className="text-xs uppercase tracking-wider text-text-muted hover:text-text-primary">
            Have a key? Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-3xl uppercase tracking-[0.18em] text-[var(--text)]">Create your account</h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Arcanum Hub hosts AI image generation, LLM prompts, and published world showcases. Pick the
          path that fits — no credit card required for either one.
        </p>
        <div className="mt-5 rounded border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-4 text-xs leading-6 text-[var(--text)]">
          <strong className="font-display uppercase tracking-[0.14em] text-[var(--warning)]">
            Beta preview
          </strong>
          <span className="text-text-muted">
            {" "}— Arcanum Hub is still under active development. Worlds, accounts, and usage counters
            may be wiped without notice while we iterate. Accounts that exceed posted quotas or clearly
            abuse the free tiers will be revoked. Treat anything you publish here as impermanent.
          </span>
        </div>

        {mode === "choose" && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              title="Try it free"
              description="10 image generations, 20 prompts. No email required. You can upgrade later."
              cta="Demo account"
              onClick={() => {
                setError(null);
                setMode("demo");
              }}
              primary
            />
            <ChoiceCard
              title="Create an account"
              description="Verify your email for 500 images, 1000 prompts (FLUX models), and the ability to publish."
              cta="Sign up"
              onClick={() => {
                setError(null);
                setMode("fullRequest");
              }}
            />
          </div>
        )}

        {mode === "demo" && (
          <Form onSubmit={doDemo} onBack={() => setMode("choose")} primary="Create demo account" busy={busy} disabled={!privacyConsent || (Boolean(turnstileSiteKey) && !turnstileToken)}>
            <p className="text-xs leading-6 text-text-muted">
              A demo account gets you enough quota to sketch one small world and see how Arcanum feels.
              We'll show you the API key once — keep it somewhere safe.
            </p>
            <Field label="Display name (optional)">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClasses}
                placeholder="Anonymous Explorer"
                autoFocus
                disabled={busy}
              />
            </Field>
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} onError={setError} />
            <PrivacyConsent checked={privacyConsent} onChange={setPrivacyConsent} disabled={busy} />
            {error && <p className="text-xs text-status-error">{error}</p>}
          </Form>
        )}

        {mode === "fullRequest" && (
          <Form
            onSubmit={doFullRequest}
            onBack={() => setMode("choose")}
            primary="Send verification code"
            busy={busy}
            disabled={!privacyConsent || !email.trim() || !displayName.trim() || (Boolean(turnstileSiteKey) && !turnstileToken)}
          >
            <p className="text-xs leading-6 text-text-muted">
              We'll email a 6-digit code. Enter it on the next screen to finish signup.
            </p>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={busy}
                className={inputClasses}
                placeholder="you@example.com"
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
                placeholder="How you want to be credited"
              />
            </Field>
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} onError={setError} />
            <PrivacyConsent checked={privacyConsent} onChange={setPrivacyConsent} disabled={busy} />
            {error && <p className="text-xs text-status-error">{error}</p>}
          </Form>
        )}

        {mode === "fullVerify" && (
          <Form onSubmit={doFullVerify} onBack={() => setMode("fullRequest")} primary="Verify and finish" busy={busy} disabled={code.length !== 6}>
            <p className="text-xs leading-6 text-text-muted">
              We sent a code to <span className="text-text-primary">{email}</span>. It expires in 15
              minutes.
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
                className={`${inputClasses} text-center font-mono text-lg tracking-[0.4em]`}
                placeholder="123456"
              />
            </Field>
            {error && <p className="text-xs text-status-error">{error}</p>}
          </Form>
        )}

        {mode === "done" && (
          <div className="mt-8 space-y-5">
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-5">
              <p className="text-xs uppercase tracking-wider text-accent">Your API key — shown once</p>
              <code className="mt-3 block break-all rounded bg-[var(--bg)] px-3 py-3 font-mono text-sm text-text-primary">
                {apiKey}
              </code>
              <p className="mt-3 text-xs leading-6 text-text-muted">
                We also saved it in this browser so you can come back to{" "}
                <Link to="/account" className="underline">/account</Link>. You won't see it here again
                after you leave — copy it now if you want to use it elsewhere.
              </p>
              <button
                onClick={() => void navigator.clipboard.writeText(apiKey)}
                className="mt-3 text-xs uppercase tracking-wider text-accent underline-offset-2 hover:underline"
              >
                Copy to clipboard
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <h2 className="font-display text-sm uppercase tracking-widest text-text-primary">Next: open Arcanum</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-6 text-text-muted">
                <li>Install the Arcanum creator (download link TBD).</li>
                <li>Run it, choose "I have a key" in the onboarding, and paste the key above.</li>
                <li>Start building — you'll see your quotas in Settings → Arcanum Hub.</li>
              </ol>
            </div>

            <div className="flex items-center justify-between text-xs">
              <Link to="/" className="text-text-muted hover:text-text-primary">
                ← Back to the world directory
              </Link>
              <button
                onClick={() => navigate("/account")}
                className={showcaseButtonClassNames.secondary}
              >
                Open account page
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-6">
        <div className="mx-auto flex max-w-xl justify-between text-xs text-text-muted">
          <Link to="/privacy" className="hover:text-text-primary">Privacy policy</Link>
          <Link to="/" className="hover:text-text-primary">Arcanum Hub</Link>
        </div>
      </footer>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────

function ChoiceCard({
  title,
  description,
  cta,
  onClick,
  primary = false,
}: {
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-xl border px-5 py-5 text-left transition ${
        primary
          ? "border-accent/50 bg-accent/10 hover:border-accent"
          : "border-[var(--border)] bg-[var(--panel)] hover:border-accent/50"
      }`}
    >
      <span className="font-display text-sm uppercase tracking-widest text-text-primary">{title}</span>
      <span className="text-xs leading-6 text-text-muted">{description}</span>
      <span className="mt-1 text-xs uppercase tracking-wider text-accent">{cta} →</span>
    </button>
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

function PrivacyConsent({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-xs leading-5 text-text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 accent-accent"
        required
      />
      <span>
        I've read and agree to the{" "}
        <Link to="/privacy" target="_blank" className="text-accent underline">
          privacy policy
        </Link>
        . Arcanum Hub stores my display name, email (if provided), and usage counters, and may
        wipe them during beta development.
      </span>
    </label>
  );
}

function Form({
  children,
  onSubmit,
  onBack,
  primary,
  busy,
  disabled,
}: {
  children: React.ReactNode;
  onSubmit: () => void | Promise<void>;
  onBack: () => void;
  primary: string;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="mt-8 flex flex-col gap-4"
    >
      {children}
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs uppercase tracking-wider text-text-muted hover:text-text-primary">
          ← Back
        </button>
        <button type="submit" disabled={busy || disabled} className={`${showcaseButtonClassNames.primary} disabled:opacity-50`}>
          {busy ? "Working…" : primary}
        </button>
      </div>
    </form>
  );
}

const inputClasses =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/60 focus:outline-none";
