import { useState } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, TextInput, NumberInput } from "@/components/ui/FormWidgets";

export function ImagesPanel({ config, onChange }: ConfigPanelProps) {
  const img = config.images;
  const patch = (p: Partial<AppConfig["images"]>) =>
    onChange({ images: { ...img, ...p } });

  const [tierDraft, setTierDraft] = useState(img.spriteLevelTiers.join(", "));

  const commitTiers = (value: string) => {
    const nums = value
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0)
      .sort((a, b) => b - a);
    if (nums.length > 0) {
      patch({ spriteLevelTiers: nums });
      setTierDraft(nums.join(", "));
    }
  };

  return (
    <>
      <Section title="Image Serving">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Base URL">
            <TextInput
              value={img.baseUrl}
              onCommit={(v) => patch({ baseUrl: v || "/images/" })}
              placeholder="/images/"
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Player Sprite Tiers">
        <p className="mb-2 text-[10px] text-text-muted">
          Level breakpoints for player sprite art. Sprites use the filename
          format:{" "}
          <code className="font-mono">
            player_sprites/race_gender_class_l&#123;tier&#125;.png
          </code>
        </p>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Level Tiers">
            <TextInput
              value={tierDraft}
              onCommit={commitTiers}
              placeholder="50, 40, 30, 20, 10, 1"
            />
          </FieldRow>
          <p className="ml-[6.5rem] text-[10px] text-text-muted">
            Comma-separated descending thresholds. Level 25 matches l20 (highest
            threshold &le; level).
          </p>
          <FieldRow label="Staff Tier">
            <NumberInput
              value={img.staffSpriteTier}
              onCommit={(v) => patch({ staffSpriteTier: v ?? 60 })}
              min={1}
            />
          </FieldRow>
          <p className="ml-[6.5rem] text-[10px] text-text-muted">
            Tier used for staff members (default 60).
          </p>
        </div>
      </Section>
    </>
  );
}
