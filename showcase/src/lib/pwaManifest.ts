import type { ShowcaseData } from "@/types/showcase";

/**
 * Inject a dynamic PWA manifest and register the service worker.
 */
export function injectManifest(meta: ShowcaseData["meta"]): void {
  const s = meta.showcase;
  const name = s?.bannerTitle ?? meta.worldName ?? "World Lore";
  const shortName = name.slice(0, 12);
  const themeColor = s?.accentColor ?? "#a897d2";
  const bgColor = s?.bgColor ?? "#22293c";

  const icons = [];
  if (s?.faviconUrl) {
    icons.push(
      { src: s.faviconUrl, sizes: "192x192", type: "image/png" },
      { src: s.faviconUrl, sizes: "512x512", type: "image/png" },
    );
  } else {
    icons.push(
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    );
  }

  const manifest = {
    name,
    short_name: shortName,
    description: meta.tagline ?? `Explore the lore of ${name}`,
    start_url: "/",
    display: "standalone",
    background_color: bgColor,
    theme_color: themeColor,
    icons,
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = url;

  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failure is non-fatal
    });
  }
}
