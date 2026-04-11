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
bun install

# Create the D1 database and R2 bucket (one-time):
wrangler d1 create arcanum-hub
wrangler r2 bucket create arcanum-hub

# Copy the D1 database_id into wrangler.toml, then:
bun run db:init:local      # dev
bun run db:init:remote     # prod

# Set the admin master key (prod):
wrangler secret put HUB_ADMIN_KEY

# Dev server on http://127.0.0.1:8787:
bun run dev

# Deploy:
bun run deploy
```

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

- `api.hub.arcanum.app/*`
- `hub.arcanum.app/*`
- `*.hub.arcanum.app/*`

The bare `hub.arcanum.app` host is intended to be served by the
`showcase/` Cloudflare Pages project (with a Worker route for
`/api/index`). `<slug>.hub.arcanum.app` is also served by that Pages
project for SPA assets; the Worker only intercepts `/showcase.json`
and `/images/*.webp`.

## R2 layout

```
worlds/<slug>/showcase.json
worlds/<slug>/images/<sha256>.webp
```

Content-addressed images are shared within a single world; across
worlds they're duplicated (simpler delete semantics, no refcounting).
