import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";

export function ImagesPanel({ config, onChange }: ConfigPanelProps) {
  const img = config.images;
  const patch = (p: Partial<AppConfig["images"]>) =>
    onChange({ images: { ...img, ...p } });

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
    </>
  );
}
