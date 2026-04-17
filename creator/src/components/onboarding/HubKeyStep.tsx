import { useEffect, useState } from "react";
import { useAssetStore } from "@/stores/assetStore";
import {
  fetchHubConfig,
  signupDemo,
  signupRequest,
  signupVerify,
  type HubUser,
} from "@/lib/hubClient";
import { TurnstileWidget } from "./TurnstileWidget";

const DEFAULT_HUB_API_URL = "https://api.arcanum-hub.com";

type Mode = "choose" | "demo" | "fullRequest" | "fullVerify" | "paste";

interface HubKeyStepProps {
  onDone: () => void;
}

export function HubKeyStep({ onDone }: HubKeyStepProps) {
  const settings = useAssetStore((s) => s.settings);
  const saveSettings = useAssetStore((s) => s.saveSettings);
  const [mode, setMode] = useState<Mode>("choose");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Shared form state across sub-flows
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [pastedKey, setPastedKey] = useState(settings?.hub_api_key ?? "");

  useEffect(() => {
    fetchHubConfig()
      .then((cfg) => setTurnstileSiteKey(cfg.turnstileSiteKey))
      .catch(() => {
        // Unreachable hub shouldn't crash onboarding — Turnstile just stays off.
        setTurnstileSiteKey("");
      });
  }, []);

  const apiUrl = settings?.hub_api_url?.trim() || DEFAULT_HUB_API_URL;

  const persistKeyAndFinish = async (apiKey: string, _user?: HubUser) => {
    if (!settings) throw new Error("Settings not loaded");
    await saveSettings({
      ...settings,
      hub_api_key: apiKey,
      hub_api_url: apiUrl,
      use_hub_ai: true,
    });
    onDone();
  };

  const runDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await signupDemo({ displayName: displayName.trim() || undefined, turnstileToken }, apiUrl);
      await persistKeyAndFinish(res.apiKey, res.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runFullRequest = async () => {
    setBusy(true);
    setError(null);
    try {
      await signupRequest(
        { email: email.trim(), displayName: displayName.trim(), turnstileToken },
        apiUrl,
      );
      setMode("fullVerify");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runFullVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await signupVerify({ email: email.trim(), code: code.trim() }, apiUrl);
      await persistKeyAndFinish(res.apiKey, res.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runPaste = async () => {
    setBusy(true);
    setError(null);
    try {
      const trimmed = pastedKey.trim();
      if (!trimmed) throw new Error("Enter your Arcanum Hub API key to continue.");
      await persistKeyAndFinish(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm leading-7 text-text-secondary">
          Arcanum Hub handles AI generation and world hosting for you — no API keys to juggle, no cloud
          accounts to set up.
        </p>
        <p className="text-xs leading-6 text-text-muted">
          Everything is saved locally to this machine. You can change it later in Settings → Arcanum Hub.
        </p>
      </div>

      {mode === "choose" && (
        <ChooseMode
          onDemo={() => {
            setError(null);
            setMode("demo");
          }}
          onSignup={() => {
            setError(null);
            setMode("fullRequest");
          }}
          onPaste={() => {
            setError(null);
            setMode("paste");
          }}
        />
      )}

      {mode === "demo" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runDemo();
          }}
          className="flex flex-col gap-4"
        >
          <h3 className="font-display text-sm uppercase tracking-widest text-text-primary">
            Try it free
          </h3>
          <p className="text-xs leading-6 text-text-muted">
            A demo account gets you 10 image generations and 20 prompt enhancements — enough to sketch
            one small world and see how everything fits together. No email required. Upgrade for free
            later with email verification.
          </p>
          <Field label="Display name (optional)">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. jnoecker"
              className={inputClasses}
              autoFocus
              disabled={busy}
            />
          </Field>
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={setTurnstileToken}
            onError={setError}
          />
          {error && <p className="text-2xs text-status-error">{error}</p>}
          <Actions
            onBack={() => setMode("choose")}
            disabled={busy || (Boolean(turnstileSiteKey) && !turnstileToken)}
            busy={busy}
            primary="Create demo account"
          />
        </form>
      )}

      {mode === "fullRequest" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runFullRequest();
          }}
          className="flex flex-col gap-4"
        >
          <h3 className="font-display text-sm uppercase tracking-widest text-text-primary">
            Create your account
          </h3>
          <p className="text-xs leading-6 text-text-muted">
            Verify your email to unlock full quotas (500 images, 5000 prompts) and the ability to
            publish worlds to the public hub. We'll email a 6-digit code in a moment.
          </p>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClasses}
              autoFocus
              required
              disabled={busy}
            />
          </Field>
          <Field label="Display name">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want to be credited"
              className={inputClasses}
              required
              disabled={busy}
            />
          </Field>
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={setTurnstileToken}
            onError={setError}
          />
          {error && <p className="text-2xs text-status-error">{error}</p>}
          <Actions
            onBack={() => setMode("choose")}
            disabled={
              busy ||
              !email.trim() ||
              !displayName.trim() ||
              (Boolean(turnstileSiteKey) && !turnstileToken)
            }
            busy={busy}
            primary="Send verification code"
          />
        </form>
      )}

      {mode === "fullVerify" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runFullVerify();
          }}
          className="flex flex-col gap-4"
        >
          <h3 className="font-display text-sm uppercase tracking-widest text-text-primary">
            Enter verification code
          </h3>
          <p className="text-xs leading-6 text-text-muted">
            We sent a 6-digit code to <span className="text-text-primary">{email}</span>. It expires in
            15 minutes.
          </p>
          <Field label="Code">
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className={`${inputClasses} text-center font-mono tracking-[0.4em]`}
              autoFocus
              required
              disabled={busy}
            />
          </Field>
          {error && <p className="text-2xs text-status-error">{error}</p>}
          <Actions
            onBack={() => setMode("fullRequest")}
            disabled={busy || code.length !== 6}
            busy={busy}
            primary="Verify and continue"
          />
        </form>
      )}

      {mode === "paste" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runPaste();
          }}
          className="flex flex-col gap-4"
        >
          <h3 className="font-display text-sm uppercase tracking-widest text-text-primary">
            Use an existing key
          </h3>
          <p className="text-xs leading-6 text-text-muted">
            If you already have an Arcanum Hub API key, paste it below.
          </p>
          <Field label="Arcanum Hub API Key">
            <input
              type="password"
              value={pastedKey}
              onChange={(e) => setPastedKey(e.target.value)}
              placeholder="hubk_full_..."
              className={`${inputClasses} font-mono`}
              autoFocus
              required
              disabled={busy}
            />
          </Field>
          {error && <p className="text-2xs text-status-error">{error}</p>}
          <Actions
            onBack={() => setMode("choose")}
            disabled={busy || !pastedKey.trim()}
            busy={busy}
            primary="Save and continue"
          />
        </form>
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────

function ChooseMode({
  onDemo,
  onSignup,
  onPaste,
}: {
  onDemo: () => void;
  onSignup: () => void;
  onPaste: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ChoiceCard
        title="Try it free"
        description="Jump in with 10 images / 20 prompts. No email needed."
        cta="Demo account"
        onClick={onDemo}
        primary
      />
      <ChoiceCard
        title="Create an account"
        description="Verify email for full quotas (500 images / 5000 prompts) and publishing."
        cta="Sign up"
        onClick={onSignup}
      />
      <ChoiceCard
        title="I have a key"
        description="Paste an existing Arcanum Hub API key."
        cta="Paste key"
        onClick={onPaste}
        span
      />
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  cta,
  onClick,
  primary = false,
  span = false,
}: {
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  primary?: boolean;
  span?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-xl border px-5 py-4 text-left transition ${
        span ? "sm:col-span-2" : ""
      } ${
        primary
          ? "border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.22),rgb(var(--surface-rgb)/0.1))] hover:shadow-[0_14px_34px_rgb(var(--accent-rgb)/0.2)]"
          : "border-border-default bg-bg-primary hover:border-accent/50"
      }`}
    >
      <span className="font-display text-sm uppercase tracking-widest text-text-primary">{title}</span>
      <span className="text-xs leading-6 text-text-muted">{description}</span>
      <span className="mt-1 text-2xs uppercase tracking-ui text-accent">{cta} →</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-2xs uppercase tracking-ui text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function Actions({
  onBack,
  primary,
  disabled,
  busy,
}: {
  onBack: () => void;
  primary: string;
  disabled: boolean;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="text-2xs uppercase tracking-ui text-text-muted transition hover:text-text-primary"
      >
        ← Back
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-full border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.3),rgb(var(--surface-rgb)/0.18))] px-6 py-2 text-sm font-medium text-text-primary transition hover:shadow-[0_14px_34px_rgb(var(--accent-rgb)/0.2)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Working…" : primary}
      </button>
    </div>
  );
}

const inputClasses =
  "w-full rounded-xl border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-border-active";
