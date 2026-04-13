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

# Set the admin master key (prod):
wrangler secret put HUB_ADMIN_KEY

# Dev server on http://127.0.0.1:8787:
npm run dev

# Deploy:
npm run deploy
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
