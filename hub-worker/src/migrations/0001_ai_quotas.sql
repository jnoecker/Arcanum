-- 0001_ai_quotas
-- Adds the hub-AI quota columns to the users table. Safe to run once
-- per deployment; SQLite does not support ADD COLUMN IF NOT EXISTS,
-- so subsequent runs will error with "duplicate column name" — that's
-- the expected signal that the migration has already been applied.
--
-- Apply with:
--   wrangler d1 execute arcanum-hub --remote --file=./src/migrations/0001_ai_quotas.sql

ALTER TABLE users ADD COLUMN images_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN images_quota INTEGER NOT NULL DEFAULT 500;
ALTER TABLE users ADD COLUMN prompts_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN prompts_quota INTEGER NOT NULL DEFAULT 5000;
