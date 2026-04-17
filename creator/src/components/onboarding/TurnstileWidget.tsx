import { useEffect, useRef } from "react";

// ─── Cloudflare Turnstile widget ─────────────────────────────────────
//
// Loads the CF Turnstile script and renders an invisible/managed
// widget in the supplied container. The widget calls `onToken` with
// the verification token once the challenge is solved; we pass that
// token along to the hub's signup endpoints.
//
// If `siteKey` is empty we render nothing and immediately fire
// `onToken("")` so the caller can still POST — the hub also skips
// verification in dev when TURNSTILE_SECRET_KEY is unset.
//
// Turnstile's widget runs in its own iframe with its own origin
// checks against the site-key's allowed domains. For Tauri we add
// `tauri.localhost` (Windows) + `localhost` to the allowed list in
// the Cloudflare dashboard when the site key is created.

declare global {
  interface Window {
    turnstile?: {
      render: (
        target: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          appearance?: "always" | "interaction-only";
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: (message: string) => void;
}

export function TurnstileWidget({ siteKey, onToken, onError }: TurnstileWidgetProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    // No site key — skip verification entirely and let the caller
    // continue. The hub will also skip, so this matches production
    // when Turnstile is intentionally disabled.
    if (!siteKey) {
      onToken("");
      return;
    }
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme: "dark",
          appearance: "interaction-only",
          callback: (token) => onToken(token),
          "error-callback": () => onError?.("Turnstile error. Try again in a moment."),
          "expired-callback": () => onToken(""),
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) onError?.(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [siteKey, onToken, onError]);

  if (!siteKey) return null;
  return <div ref={ref} className="mt-2" />;
}
