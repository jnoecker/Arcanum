# Arcanum Hub Worker

Cloudflare Worker that backs the central Arcanum Hub. It handles:

- **Publish API** (`api.<root>`) — Bearer-auth endpoints for the Arcanum
  desktop client to upload compressed showcase JSON + WEBP images.
- **Admin API** (`api.<root>/admin/*`) — master-key guarded endpoints
  for the separate `hub-admin` SPA (create users, rotate keys, delete
  worlds).
- **Per-world data** (`<slug>.<root>`) — serves `/showcase.json` from
  R2, keyed by the Host header's subdomain.
- **Hub index** (`api.<root>/index` or `<root>/api/index`) — returns
  the list of worlds flagged as `listed` for the landing page.

The showcase SPA (in `../showcase/`) becomes multi-tenant: on the hub
root domain it renders a world directory, on `<slug>.<root>` it loads
that world's showcase.json from the Worker, and anywhere else it falls
back to the existing self-hosted behaviour unchanged.

## Setup

```bash
npm install

# Create the D1 database and R2 bucket (one-time):
wrangler d1 create arcanum-hub
wrangler r2 bucket create arcanum-hub

# Copy the D1 database_id into wrangler.toml, then:
npm run db:init:local      # dev
npm run db:init:remote     # prod

# Set secrets (prod):
wrangler secret put HUB_ADMIN_KEY         # admin dashboard master key
wrangler secret put RESEND_API_KEY        # transactional email (https://resend.com)
wrangler secret put TURNSTILE_SECRET_KEY  # CF Turnstile (pair with TURNSTILE_SITE_KEY in [vars])
wrangler secret put RUNWARE_API_KEY       # image generation
wrangler secret put OPENROUTER_API_KEY    # text LLM
wrangler secret put ANTHROPIC_API_KEY     # vision LLM

# Dev server on http://127.0.0.1:8787:
npm run dev

# Deploy:
npm run deploy
```

### Applying migrations

Schema edits go in `src/migrations/NNNN_name.sql`. Apply them in
order against the target environment:

```bash
wrangler d1 execute arcanum-hub --remote --file=./src/migrations/0004_self_registration.sql
```

### Self-registration setup

Public signup (`/signup/*`) and account management (`/account/*`)
require two external services:

1. **Resend** — create an account, verify the domain you'll send from
   (`arcanum-hub.com`), set `FROM_EMAIL` in `[vars]` to something on
   that domain, and `wrangler secret put RESEND_API_KEY`. Without a
   key the worker logs verification codes to `wrangler tail` instead
   of emailing them — fine for dev, broken for users.
2. **Cloudflare Turnstile** — create a site in the CF dashboard, add
   `arcanum-hub.com`, `*.arcanum-hub.com`, `tauri.localhost`, and
   `localhost` to the allowed domains. Put the public site key in
   `wrangler.toml` `[vars].TURNSTILE_SITE_KEY` and
   `wrangler secret put TURNSTILE_SECRET_KEY` for the server secret.
   Without either, Turnstile verification is skipped (rate limits
   + email verification still apply).

## Development routing

`wrangler dev` runs on a single localhost port, so the Worker falls
back to path-prefixed routes when it can't parse a hub subdomain from
the Host header:

```
GET  /                             readme / help
/api/publish/*                     publish API (strip /api to get prod path)
/api/admin/*                       admin API
/dev/world/<slug>/showcase.json    simulates <slug>.<root>/showcase.json
/dev/world/<slug>/images/<h>.webp  simulates <slug>.<root>/images/...
```

## Production routing

Set up these three routes in Cloudflare once DNS is ready:

- `api.arcanum-hub.com/*`
- `arcanum-hub.com/*`
- `*.arcanum-hub.com/*`

The Worker owns every path under these hosts. SPA assets (the
multi-tenant showcase build) are bundled into the Worker via the
`[assets]` binding pointed at `../showcase/dist`. The Worker
intercepts `/api/*`, `/showcase.json`, and `/images/*.webp` before
falling through to the SPA via `run_worker_first = true`.

Cloudflare Pages rejects wildcard custom domains, which is why the
SPA ships inside the Worker rather than from a Pages project.

## R2 layout

```
worlds/<slug>/showcase.json
worlds/<slug>/images/<sha256>.webp
```

Content-addressed images are shared within a single world; across
worlds they're duplicated (simpler delete semantics, no refcounting).
