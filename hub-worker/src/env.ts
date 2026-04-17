export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  /** Showcase SPA bundle, served via Worker assets so wildcard subdomains work. */
  ASSETS: Fetcher;
  HUB_ROOT_DOMAIN: string;
  ADMIN_ORIGIN: string;
  HUB_ADMIN_KEY: string;
  // ─── AI provider secrets (for hub-proxied generation) ───────────────
  RUNWARE_API_KEY: string;
  OPENROUTER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  // ─── Self-registration ──────────────────────────────────────────────
  // Resend transactional email for verification codes. Domain must be
  // verified in the Resend console and FROM_EMAIL must be on that domain.
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  // Cloudflare Turnstile — TURNSTILE_SITE_KEY is public (safe in [vars]).
  // TURNSTILE_SECRET_KEY is a secret. If both are empty the worker
  // skips Turnstile verification, which is the expected state in dev.
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}
