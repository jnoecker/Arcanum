-- 0004_self_registration
-- Opens the hub to public signup. Two paths:
--   1. Anonymous "demo" tier — no email, tiny quotas, no publish.
--   2. Email-verified "full" tier — 6-digit code, normal quotas, publish.
--
-- Existing users (all admin-created) are grandfathered as email_verified=1
-- so publish gating doesn't retroactively break them.
--
-- Apply with:
--   wrangler d1 execute arcanum-hub --remote --file=./src/migrations/0004_self_registration.sql

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
UPDATE users SET email_verified = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Pending email verifications. One row per email — a fresh /signup/request
-- for the same address overwrites the prior code.
CREATE TABLE IF NOT EXISTS verification_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  -- If set, the verify step upgrades this existing demo user to full
  -- instead of creating a new record. Lets demo users keep their
  -- user_id (and any worlds they'd try to publish) across upgrade.
  existing_user_id TEXT,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_expires ON verification_codes(expires_at);

-- Per-IP signup attempt log. We count rows within a rolling window to
-- enforce the rate limit; old rows are pruned lazily on each attempt.
CREATE TABLE IF NOT EXISTS signup_attempts (
  ip TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time ON signup_attempts(ip, attempted_at);
