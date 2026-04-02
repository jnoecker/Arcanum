import type { ShowcaseData } from "@/types/showcase";

/**
 * Apply showcase branding overrides to the document at runtime.
 * Sets CSS custom properties, favicon, and document title.
 */
export function applyBranding(meta: ShowcaseData["meta"]): void {
  const s = meta.showcase;
  const root = document.documentElement.style;

  if (s?.accentColor) {
    root.setProperty("--color-accent", s.accentColor);
    // Derive a slightly dimmer muted variant
    root.setProperty("--color-accent-muted", s.accentColor);
  }

  if (s?.bgColor) {
    root.setProperty("--color-bg-abyss", s.bgColor);
    root.setProperty("--color-bg-primary", s.bgColor);
  }

  if (s?.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = s.faviconUrl;

    // Also update apple-touch-icon
    let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      document.head.appendChild(apple);
    }
    apple.href = s.faviconUrl;
  }

  // Update theme-color meta tag
  const themeColor = s?.accentColor ?? "#a897d2";
  let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = themeColor;

  document.title = s?.bannerTitle ?? meta.worldName ?? "World Lore";
}
