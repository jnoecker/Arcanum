-- 0003_world_metadata
-- Adds discovery metadata to the worlds table so the hub landing page
-- can render richer cards, support search/filter, and power per-world
-- OpenGraph tags without re-parsing every showcase.json on demand.
--
-- All values are derived server-side from the uploaded manifest on
-- each publish — the creator never sends them directly. Existing rows
-- get populated on their next publish; until then the columns stay at
-- their defaults (zero / null) which the landing page tolerates.
--
-- Apply with:
--   wrangler d1 execute arcanum-hub --remote --file=./src/migrations/0003_world_metadata.sql

ALTER TABLE worlds ADD COLUMN article_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE worlds ADD COLUMN map_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE worlds ADD COLUMN image_count INTEGER NOT NULL DEFAULT 0;
-- SHA-256 hash (no extension) of the representative cover image, or
-- NULL if the world has no usable image. The full URL is reconstructed
-- on read as https://<slug>.<root>/images/<hash>.webp.
ALTER TABLE worlds ADD COLUMN cover_image_hash TEXT;
-- JSON array of unique article tags (lowercase, deduped, capped).
ALTER TABLE worlds ADD COLUMN tags TEXT;
-- Denormalized from users.display_name at publish time so the landing
-- page can show "by <author>" without a join on every card.
ALTER TABLE worlds ADD COLUMN author_display_name TEXT;
-- A short description pulled from showcase.meta.tagline or derived
-- from the world_setting article's first paragraph — used on cards
-- and in OG meta.
ALTER TABLE worlds ADD COLUMN description TEXT;
