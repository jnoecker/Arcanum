import type { ShowcaseSettings } from "@/types/lore";
import { useLoreStore } from "@/stores/loreStore";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";

const EMPTY_SETTINGS: ShowcaseSettings = {};

export function ShowcaseSettingsPanel() {
  const settings = useLoreStore((s) => s.lore?.showcaseSettings ?? EMPTY_SETTINGS);
  const update = useLoreStore((s) => s.updateShowcaseSettings);

  return (
    <div className="space-y-6">
      <Section title="Branding" defaultExpanded>
        <FieldRow label="Nav Logo Text">
          <TextInput
            value={settings.navLogoText ?? ""}
            onCommit={(v) => update({ navLogoText: v || undefined })}
            placeholder="Defaults to world name"
          />
        </FieldRow>
        <FieldRow label="Banner Title">
          <TextInput
            value={settings.bannerTitle ?? ""}
            onCommit={(v) => update({ bannerTitle: v || undefined })}
            placeholder="Defaults to world name"
          />
        </FieldRow>
        <FieldRow label="Banner Subtitle">
          <TextInput
            value={settings.bannerSubtitle ?? ""}
            onCommit={(v) => update({ bannerSubtitle: v || undefined })}
            placeholder="Defaults to world tagline"
          />
        </FieldRow>
        <FieldRow label="Footer Text">
          <TextInput
            value={settings.footerText ?? ""}
            onCommit={(v) => update({ footerText: v || undefined })}
            placeholder="Built with Ambon Arcanum"
          />
        </FieldRow>
      </Section>

      <Section title="Colors">
        <FieldRow label="Accent Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.accentColor || "#a897d2"}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border-default bg-bg-primary"
            />
            <TextInput
              value={settings.accentColor ?? ""}
              onCommit={(v) => update({ accentColor: v || undefined })}
              placeholder="#a897d2"
            />
          </div>
        </FieldRow>
        <FieldRow label="Background Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.bgColor || "#22293c"}
              onChange={(e) => update({ bgColor: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border-default bg-bg-primary"
            />
            <TextInput
              value={settings.bgColor ?? ""}
              onCommit={(v) => update({ bgColor: v || undefined })}
              placeholder="#22293c"
            />
          </div>
        </FieldRow>
      </Section>

      <Section title="Icons">
        <FieldRow label="Favicon URL">
          <TextInput
            value={settings.faviconUrl ?? ""}
            onCommit={(v) => update({ faviconUrl: v || undefined })}
            placeholder="URL to a favicon image (e.g. from R2)"
          />
        </FieldRow>
      </Section>
    </div>
  );
}
