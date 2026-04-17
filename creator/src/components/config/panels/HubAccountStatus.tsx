import { useEffect, useState } from "react";
import {
  fetchAccount,
  fetchHubConfig,
  rotateKey,
  upgradeRequest,
  upgradeVerify,
  type HubAccount,
} from "@/lib/hubClient";
import { TurnstileWidget } from "@/components/onboarding/TurnstileWidget";
import { useAssetStore } from "@/stores/assetStore";

interface HubAccountStatusProps {
  apiKey: string;
  apiUrl: string;
}

/**
 * Shows the user's current hub account — tier, quota usage, email
 * verification state — and exposes demo→full upgrade and key
 * rotation. Lives at the top of HubSettingsPanel.
 */
export function HubAccountStatus({ apiKey, apiUrl }: HubAccountStatusProps) {
  const settings = useAssetStore((s) => s.settings);
  const saveSettings = useAssetStore((s) => s.saveSettings);
  const [account, setAccount] = useState<HubAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { account } = await fetchAccount(apiKey, apiUrl);
      setAccount(account);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) void refresh();
    else setAccount(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, apiUrl]);

  const handleRotate = async () => {
    if (!settings) return;
    if (!confirm("Rotate your API key? The current key will be invalidated and usage counters will reset.")) return;
    try {
      setLoading(true);
      const { apiKey: fresh } = await rotateKey(apiKey, apiUrl);
      await saveSettings({ ...settings, hub_api_key: fresh });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-primary px-4 py-3 text-xs text-text-muted">
        No API key configured — enter one below or complete the onboarding flow from the toolbar.
      </div>
    );
  }

  if (loading && !account) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-primary px-4 py-3 text-xs text-text-muted">
        Loading account…
      </div>
    );
  }

  if (error && !account) {
    return (
      <div className="rounded-lg border border-status-error/50 bg-bg-primary px-4 py-3 text-xs text-status-error">
        {error}
        <button onClick={refresh} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  if (!account) return null;

  const imagePct = pct(account.usage.imagesUsed, account.usage.imagesQuota);
  const promptPct = pct(account.usage.promptsUsed, account.usage.promptsQuota);

  return (
    <div className="rounded-lg border border-border-default bg-bg-primary px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-display text-xs uppercase tracking-widest text-text-primary">
            {account.displayName}
          </span>
          <span className="mt-0.5 text-2xs text-text-muted">
            {account.email ?? "no email on file"}
            {account.emailVerified && (
              <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                verified
              </span>
            )}
          </span>
        </div>
        <TierBadge tier={account.tier} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <UsageBar
          label="Images"
          used={account.usage.imagesUsed}
          quota={account.usage.imagesQuota}
          pct={imagePct}
        />
        <UsageBar
          label="Prompts"
          used={account.usage.promptsUsed}
          quota={account.usage.promptsQuota}
          pct={promptPct}
        />
      </div>

      {account.tier === "demo" && !showUpgrade && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-2xs text-text-secondary">
          <span>
            <span className="text-text-primary">Unlock publishing + higher quotas</span> by verifying
            your email.
          </span>
          <button
            onClick={() => setShowUpgrade(true)}
            className="rounded-full bg-accent/30 px-3 py-1 text-[11px] uppercase tracking-wider text-text-primary hover:bg-accent/50"
          >
            Upgrade
          </button>
        </div>
      )}

      {showUpgrade && (
        <UpgradePanel
          apiKey={apiKey}
          apiUrl={apiUrl}
          defaultDisplayName={account.displayName}
          onDone={async () => {
            setShowUpgrade(false);
            await refresh();
          }}
          onCancel={() => setShowUpgrade(false)}
        />
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-2xs text-text-muted">
        <span>Rotating your key starts a fresh usage allowance.</span>
        <button
          onClick={handleRotate}
          disabled={loading}
          className="rounded border border-border-default px-3 py-1 text-text-secondary transition hover:border-accent/50 hover:text-text-primary disabled:opacity-50"
        >
          Rotate key
        </button>
      </div>
      {error && <p className="mt-2 text-2xs text-status-error">{error}</p>}
    </div>
  );
}

function TierBadge({ tier }: { tier: HubAccount["tier"] }) {
  const style =
    tier === "demo"
      ? "border-border-default bg-bg-elevated text-text-muted"
      : tier === "full"
        ? "border-accent/40 bg-accent/20 text-accent"
        : "border-border-default bg-bg-elevated text-text-secondary";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${style}`}>
      {tier}
    </span>
  );
}

function UsageBar({ label, used, quota, pct }: { label: string; used: number; quota: number; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-2xs">
        <span className="uppercase tracking-ui text-text-muted">{label}</span>
        <span className="font-mono text-text-secondary">
          {used} / {quota}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={`h-full ${pct >= 90 ? "bg-status-error" : pct >= 70 ? "bg-warm" : "bg-accent"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function pct(a: number, b: number): number {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

// ─── Upgrade flow ────────────────────────────────────────────────────

function UpgradePanel({
  apiKey,
  apiUrl,
  defaultDisplayName,
  onDone,
  onCancel,
}: {
  apiKey: string;
  apiUrl: string;
  defaultDisplayName: string;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const settings = useAssetStore((s) => s.settings);
  const saveSettings = useAssetStore((s) => s.saveSettings);

  const [stage, setStage] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [code, setCode] = useState("");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHubConfig(apiUrl)
      .then((cfg) => setTurnstileSiteKey(cfg.turnstileSiteKey))
      .catch(() => setTurnstileSiteKey(""));
  }, [apiUrl]);

  const doRequest = async () => {
    setBusy(true);
    setError(null);
    try {
      await upgradeRequest(
        apiKey,
        { email: email.trim(), displayName: displayName.trim(), turnstileToken },
        apiUrl,
      );
      setStage("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const res = await upgradeVerify(apiKey, { email: email.trim(), code: code.trim() }, apiUrl);
      await saveSettings({ ...settings, hub_api_key: res.apiKey });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded border border-accent/40 bg-bg-primary p-3">
      {stage === "request" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doRequest();
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-2xs leading-5 text-text-muted">
            Enter your email — we'll send a 6-digit code to verify it. Once verified, your account is
            promoted to full (500 images / 5000 prompts) and publishing is enabled.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={busy}
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent/50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={busy}
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent/50"
            />
          </label>
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={setTurnstileToken}
            onError={setError}
          />
          {error && <p className="text-2xs text-status-error">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-2xs uppercase tracking-ui text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !email.trim() || !displayName.trim() || (Boolean(turnstileSiteKey) && !turnstileToken)}
              className="rounded-full border border-accent/40 bg-accent/30 px-4 py-1.5 text-xs text-text-primary transition hover:bg-accent/50 disabled:opacity-50"
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
          <p className="text-2xs leading-5 text-text-muted">
            We sent a 6-digit code to <span className="text-text-primary">{email}</span>. Expires in
            15 minutes.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Code</span>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              disabled={busy}
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-center font-mono tracking-[0.4em] text-sm text-text-primary focus:border-accent/50"
            />
          </label>
          {error && <p className="text-2xs text-status-error">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setStage("request")}
              className="text-2xs uppercase tracking-ui text-text-muted hover:text-text-primary"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="rounded-full border border-accent/40 bg-accent/30 px-4 py-1.5 text-xs text-text-primary transition hover:bg-accent/50 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
