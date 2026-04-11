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
}
