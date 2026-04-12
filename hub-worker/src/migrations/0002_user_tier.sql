-- 0002_user_tier
-- Adds a tier column to users so we can issue publish-only keys that
-- can upload showcase content but are rejected from every /ai/*
-- endpoint. Existing rows default to 'full' — the hub gave out
-- full-access keys before this migration, so that's the only safe
-- choice. New rows are inserted with whichever tier the admin picks.
--
-- Apply with:
--   wrangler d1 execute arcanum-hub --remote --file=./src/migrations/0002_user_tier.sql

ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'full';
