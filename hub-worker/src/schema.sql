-- Arcanum Hub D1 schema
-- Run with: wrangler d1 execute arcanum-hub --local --file=./src/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  api_key_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_publish_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash);

CREATE TABLE IF NOT EXISTS worlds (
  slug TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT,
  listed INTEGER NOT NULL DEFAULT 0,
  tagline TEXT,
  last_publish_at INTEGER,
  bytes_used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_worlds_user_id ON worlds(user_id);
CREATE INDEX IF NOT EXISTS idx_worlds_listed ON worlds(listed, last_publish_at);
