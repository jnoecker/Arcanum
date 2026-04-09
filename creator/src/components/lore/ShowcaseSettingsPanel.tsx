import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { ShowcaseSettings } from "@/types/lore";
import { useLoreStore } from "@/stores/loreStore";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";

const EMPTY_SETTINGS: ShowcaseSettings = {};

function ImagePicker({
  value,
  onChange,
  label,
  assetType,
}: {
  value: string | undefined;
  onChange: (filename: string | undefined) => void;
  label: string;
  assetType: string;
}) {
  const importAsset = useAssetStore((s) => s.importAsset);
  const [importing, setImporting] = useState(false);
  const preview = useImageSrc(value);

  const handlePick = useCallback(async () => {
    const filePath = await open({
      multiple: false,
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (!filePath || typeof filePath !== "string") return;

    setImporting(true);
    try {
      const entry = await importAsset(filePath, assetType, { zone: "lore", entity_type: "showcase", entity_id: label.toLowerCase() });
      onChange(entry.file_name);
    } catch (err) {
      console.error(`Failed to import ${label}:`, err);
    } finally {
      setImporting(false);
    }
  }, [importAsset, assetType, label, onChange]);

  return (
    <div className="flex items-start gap-3">
      {preview && (
        <img src={preview} alt={label} className="w-12 h-12 rounded-lg object-cover border border-border-muted shrink-0" />
      )}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePick}
            disabled={importing}
            className="rounded border border-border-default bg-bg-secondary px-3 py-1.5 text-2xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
          >
            {importing ? "Importing..." : value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button
              onClick={() => onChange(undefined)}
              className="text-2xs text-text-muted hover:text-status-danger"
            >
              Remove
            </button>
          )}
        </div>
        {value && <span className="text-3xs text-text-muted truncate block">{value}</span>}
      </div>
    </div>
  );
}

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
            placeholder="Built with Arcanum"
          />
        </FieldRow>
      </Section>

      <Section title="Images">
        <FieldRow label="Favicon">
          <ImagePicker
            value={settings.faviconUrl}
            onChange={(v) => update({ faviconUrl: v })}
            label="Favicon"
            assetType="lore_map"
          />
        </FieldRow>
        <FieldRow label="Banner Image">
          <ImagePicker
            value={settings.bannerImage}
            onChange={(v) => update({ bannerImage: v })}
            label="Banner"
            assetType="lore_map"
          />
        </FieldRow>
      </Section>

      <Section title="Colors">
        <FieldRow label="Accent Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.accentColor || "#ff7d00"}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border-default bg-bg-primary"
            />
            <TextInput
              value={settings.accentColor ?? ""}
              onCommit={(v) => update({ accentColor: v || undefined })}
              placeholder="#ff7d00"
            />
          </div>
        </FieldRow>
        <FieldRow label="Background Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.bgColor || "#001524"}
              onChange={(e) => update({ bgColor: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border-default bg-bg-primary"
            />
            <TextInput
              value={settings.bgColor ?? ""}
              onCommit={(v) => update({ bgColor: v || undefined })}
              placeholder="#001524"
            />
          </div>
        </FieldRow>
      </Section>
    </div>
  );
}
