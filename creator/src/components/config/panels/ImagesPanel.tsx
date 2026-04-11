import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";

export function ImagesPanel({ config, onChange }: ConfigPanelProps) {
  const img = config.images;
  const patch = (p: Partial<AppConfig["images"]>) =>
    onChange({ images: { ...img, ...p } });

  return (
    <Section
      title="Image Serving"
      description="Base URL for serving images to the game client. In production this typically points to your CDN or Cloudflare R2 custom domain."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Base URL" hint="URL prefix for all image assets. Use '/images/' for local serving, or a full CDN URL like 'https://assets.yourgame.com/' for production.">
          <TextInput
            value={img.baseUrl}
            onCommit={(v) => patch({ baseUrl: v || "/images/" })}
            placeholder="/images/"
          />
        </FieldRow>
      </div>
    </Section>
  );
}
