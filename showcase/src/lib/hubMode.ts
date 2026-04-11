// ─── Hub mode detection ──────────────────────────────────────────────
//
// The multi-tenant deployment runs under a single root domain:
//   - hub.arcanum.app              → root (landing page, world index)
//   - <slug>.hub.arcanum.app       → per-world showcase
//   - self-hosted.example.com      → legacy self-hosted (unchanged)
//
// This helper inspects window.location to figure out which case we're
// in. The root domain is controlled by the VITE_HUB_ROOT_DOMAIN env
// var — when unset, hub mode is disabled and every request is treated
// as self-hosted (preserving the existing behaviour exactly).

export type HubMode =
  | { kind: "root" } // Landing page on the bare hub root
  | { kind: "world"; slug: string } // <slug>.<root>
  | { kind: "self-hosted" }; // Anything else

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function detectHubMode(): HubMode {
  if (typeof window === "undefined") return { kind: "self-hosted" };

  const rootDomain = import.meta.env.VITE_HUB_ROOT_DOMAIN?.toLowerCase().trim();
  if (!rootDomain) return { kind: "self-hosted" };

  const host = window.location.hostname.toLowerCase();
  if (host === rootDomain) return { kind: "root" };

  if (host.endsWith(`.${rootDomain}`)) {
    const slug = host.slice(0, host.length - rootDomain.length - 1);
    // Guard against sub-subdomains like foo.bar.hub.arcanum.app
    if (slug && !slug.includes(".") && SLUG_RE.test(slug)) {
      return { kind: "world", slug };
    }
  }

  return { kind: "self-hosted" };
}

export interface HubIndexWorld {
  slug: string;
  displayName: string;
  tagline: string | null;
  lastPublishAt: number | null;
  url: string;
}

export interface HubIndexResponse {
  worlds: HubIndexWorld[];
}

/** Fetch the listed-worlds directory from the hub API. */
export async function fetchHubIndex(signal?: AbortSignal): Promise<HubIndexResponse> {
  // The Worker serves this directly from the root host at /api/index.
  const resp = await fetch("/api/index", { signal });
  if (!resp.ok) throw new Error(`Hub index fetch failed (${resp.status})`);
  return (await resp.json()) as HubIndexResponse;
}
