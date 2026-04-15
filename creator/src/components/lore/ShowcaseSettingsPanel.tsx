import { useMemo } from "react";
import type { ShowcaseSettings } from "@/types/lore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { composePrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import type { AssetContext, AssetType } from "@/types/assets";

const EMPTY_SETTINGS: ShowcaseSettings = {};

const DEFAULT_ACCENT = "#ff7d00";
const DEFAULT_BG = "#001524";

/** Pull a short world-identity summary from the world_setting article for
 *  use as placeholder defaults and as LLM context when generating art. */
function useWorldIdentity() {
  const articles = useLoreStore(selectArticles);
  return useMemo(() => {
    const ws = Object.values(articles).find((a) => a.template === "world_setting");
    const f = ws?.fields ?? {};
    const name = typeof f.name === "string" ? f.name : "";
    const tagline = typeof f.tagline === "string" ? f.tagline : "";
    const tone = typeof f.tone === "string" ? f.tone : "";
    const themes = Array.isArray(f.themes) ? (f.themes as string[]).join(", ") : "";
    return { name, tagline, tone, themes };
  }, [articles]);
}

function buildShowcaseContext(
  assetType: "showcase_banner" | "showcase_favicon",
  identity: { name: string; tagline: string; tone: string; themes: string },
  settings: ShowcaseSettings,
): string {
  const parts: string[] = [];
  parts.push(
    assetType === "showcase_banner"
      ? "Target: hero banner image for a public lore website showcasing this fantasy world. The banner sits at the top of the landing page behind the title text."
      : "Target: favicon / world-mark icon for the public lore website. It will be displayed at sizes as small as 16×16 pixels in browser tabs. Must read as a bold silhouette at tiny sizes.",
  );
  if (identity.name) parts.push(`World name: ${identity.name}`);
  const title = settings.bannerTitle?.trim() || identity.name;
  const subtitle = settings.bannerSubtitle?.trim() || identity.tagline;
  if (title) parts.push(`Title text overlaid on banner: ${title}`);
  if (subtitle) parts.push(`Subtitle: ${subtitle}`);
  if (identity.tone) parts.push(`Tone: ${identity.tone}`);
  if (identity.themes) parts.push(`Themes: ${identity.themes}`);
  return parts.join("\n");
}

function bannerPrompt(style: ArtStyle, settings: ShowcaseSettings, identity: { tagline: string }): string {
  const base = composePrompt("showcase_banner", style);
  const subject = settings.bannerSubtitle?.trim() || identity.tagline;
  return subject ? `${base}\n\nEvoke: ${subject}` : base;
}

function faviconPrompt(style: ArtStyle, identity: { name: string }): string {
  const base = composePrompt("showcase_favicon", style);
  return identity.name ? `${base}\n\nRepresenting: ${identity.name}` : base;
}

// ─── Live preview ──────────────────────────────────────────────────

function ShowcasePreview({
  settings,
  identity,
}: {
  settings: ShowcaseSettings;
  identity: { name: string; tagline: string };
}) {
  const bannerSrc = useImageSrc(settings.bannerImage);
  const faviconSrc = useImageSrc(settings.faviconUrl);
  const accent = settings.accentColor?.trim() || DEFAULT_ACCENT;
  const bg = settings.bgColor?.trim() || DEFAULT_BG;
  const navLogo = settings.navLogoText?.trim() || identity.name || "Your World";
  const title = settings.bannerTitle?.trim() || identity.name || "Your World";
  const subtitle = settings.bannerSubtitle?.trim() || identity.tagline || "A tagline for your world";
  const footer = settings.footerText?.trim() || "Built with Arcanum";

  return (
    <div className="overflow-hidden rounded-xl border border-border-default shadow-lg">
      {/* Faux browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border-muted bg-bg-tertiary px-3 py-2">
        {/* Fixed macOS-style window dots — intentional non-themed chrome */}
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-2 rounded-md bg-bg-secondary px-2.5 py-1">
          {faviconSrc ? (
            <img src={faviconSrc} alt="favicon" className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover" />
          ) : (
            <div
              className="h-3.5 w-3.5 shrink-0 rounded-sm"
              style={{ backgroundColor: accent, opacity: 0.7 }}
              aria-hidden
            />
          )}
          <span className="truncate text-2xs text-text-muted">{navLogo.toLowerCase().replace(/\s+/g, "")}.arcanum-hub.com</span>
        </div>
      </div>

      {/* Page body */}
      <div style={{ backgroundColor: bg }} className="relative">
        {/* Nav bar */}
        <div className="flex items-center justify-between border-b border-[var(--chrome-stroke)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            {faviconSrc && <img src={faviconSrc} alt="" className="h-5 w-5 rounded object-cover" />}
            <span className="font-display text-sm" style={{ color: accent }}>{navLogo}</span>
          </div>
          <div className="flex gap-3 text-2xs text-text-secondary">
            <span>Codex</span>
            <span>Maps</span>
            <span>Timeline</span>
          </div>
        </div>

        {/* Banner */}
        <div className="relative flex min-h-[10rem] items-center justify-center overflow-hidden">
          {bannerSrc ? (
            <>
              <img src={bannerSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-scrim-heavy)] via-[var(--bg-scrim-code)] to-[var(--bg-scrim-heavy)]" />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${bg}, ${accent}33)`,
              }}
              aria-hidden
            />
          )}
          <div className="relative px-6 py-10 text-center">
            <h1 className="font-display text-2xl font-semibold text-text-primary drop-shadow">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 text-xs" style={{ color: accent }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--chrome-stroke)] px-4 py-2 text-center text-3xs text-text-muted">
          {footer}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function ShowcaseSettingsPanel() {
  const settings = useLoreStore((s) => s.lore?.showcaseSettings ?? EMPTY_SETTINGS);
  const update = useLoreStore((s) => s.updateShowcaseSettings);
  const identity = useWorldIdentity();

  const bannerContext: AssetContext = {
    zone: "lore",
    entity_type: "showcase_banner",
    entity_id: "site_banner",
  };
  const faviconContext: AssetContext = {
    zone: "lore",
    entity_type: "showcase_favicon",
    entity_id: "site_favicon",
  };

  return (
    <div className="space-y-6">
      <Section title="Preview" defaultExpanded>
        <p className="mb-3 text-2xs text-text-muted">
          A rough approximation of how your published lore site will look with the current settings.
        </p>
        <ShowcasePreview settings={settings} identity={identity} />
      </Section>

      <Section title="Identity" defaultExpanded>
        <p className="mb-3 text-2xs text-text-muted">
          Text overrides for the published site. Leave blank to inherit from your World Setting.
        </p>
        <FieldRow label="Nav logo text">
          <TextInput
            value={settings.navLogoText ?? ""}
            onCommit={(v) => update({ navLogoText: v || undefined })}
            placeholder={identity.name || "Your world name"}
          />
        </FieldRow>
        <FieldRow label="Banner title">
          <TextInput
            value={settings.bannerTitle ?? ""}
            onCommit={(v) => update({ bannerTitle: v || undefined })}
            placeholder={identity.name || "Your world name"}
          />
        </FieldRow>
        <FieldRow label="Banner subtitle">
          <TextInput
            value={settings.bannerSubtitle ?? ""}
            onCommit={(v) => update({ bannerSubtitle: v || undefined })}
            placeholder={identity.tagline || "A one-line hook for the site"}
          />
        </FieldRow>
        <FieldRow label="Footer">
          <TextInput
            value={settings.footerText ?? ""}
            onCommit={(v) => update({ footerText: v || undefined })}
            placeholder="Built with Arcanum"
          />
        </FieldRow>
      </Section>

      <Section title="Visuals" defaultExpanded>
        <div className="mb-3 space-y-0.5 text-2xs text-text-muted">
          <p>Generate or upload the hero banner and favicon. Prompts auto-inject your world's identity and themes.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h4 className="text-xs font-medium uppercase tracking-ui text-text-secondary">Banner</h4>
              <span className="text-3xs text-text-muted">1792×768 · landing page hero</span>
            </div>
            <EntityArtGenerator
              getPrompt={(style) => bannerPrompt(style, settings, identity)}
              entityContext={buildShowcaseContext("showcase_banner", identity, settings)}
              currentImage={settings.bannerImage}
              onAccept={(fileName) => update({ bannerImage: fileName })}
              assetType={"showcase_banner" as AssetType}
              context={bannerContext}
              surface="lore"
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h4 className="text-xs font-medium uppercase tracking-ui text-text-secondary">Favicon</h4>
              <span className="text-3xs text-text-muted">512×512 · browser tab icon</span>
            </div>
            <EntityArtGenerator
              getPrompt={(style) => faviconPrompt(style, identity)}
              entityContext={buildShowcaseContext("showcase_favicon", identity, settings)}
              currentImage={settings.faviconUrl}
              onAccept={(fileName) => update({ faviconUrl: fileName })}
              assetType={"showcase_favicon" as AssetType}
              context={faviconContext}
              surface="lore"
            />
          </div>
        </div>
      </Section>

      <Section title="Palette">
        <p className="mb-3 text-2xs text-text-muted">
          Accent color drives titles and highlights; background fills the page behind the banner.
        </p>
        <FieldRow label="Accent color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.accentColor || DEFAULT_ACCENT}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border border-border-default bg-bg-primary"
              aria-label="Accent color picker"
            />
            <TextInput
              value={settings.accentColor ?? ""}
              onCommit={(v) => update({ accentColor: v || undefined })}
              placeholder={DEFAULT_ACCENT}
            />
            {settings.accentColor && (
              <button
                onClick={() => update({ accentColor: undefined })}
                className="text-2xs text-text-muted hover:text-status-danger"
                title="Reset to default"
              >
                Reset
              </button>
            )}
          </div>
        </FieldRow>
        <FieldRow label="Background color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.bgColor || DEFAULT_BG}
              onChange={(e) => update({ bgColor: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border border-border-default bg-bg-primary"
              aria-label="Background color picker"
            />
            <TextInput
              value={settings.bgColor ?? ""}
              onCommit={(v) => update({ bgColor: v || undefined })}
              placeholder={DEFAULT_BG}
            />
            {settings.bgColor && (
              <button
                onClick={() => update({ bgColor: undefined })}
                className="text-2xs text-text-muted hover:text-status-danger"
                title="Reset to default"
              >
                Reset
              </button>
            )}
          </div>
        </FieldRow>
      </Section>
    </div>
  );
}
