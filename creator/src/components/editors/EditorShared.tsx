import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import type { ArtStyle } from "@/lib/arcanumPrompts";

export function DeleteEntityButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="mt-4 border-t border-border-muted pt-3">
      <button
        onClick={onClick}
        className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
      >
        {label}
      </button>
    </div>
  );
}

export function MediaSection({
  image,
  onImageChange,
  getPrompt,
}: {
  image: string | undefined;
  onImageChange: (v: string | undefined) => void;
  getPrompt?: (style: ArtStyle) => string;
}) {
  return (
    <Section title="Media">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Image">
          <TextInput
            value={image ?? ""}
            onCommit={(v) => onImageChange(v || undefined)}
            placeholder="none"
          />
        </FieldRow>
        {getPrompt && (
          <EntityArtGenerator
            getPrompt={getPrompt}
            currentImage={image}
            onAccept={(filePath) => onImageChange(filePath)}
          />
        )}
      </div>
    </Section>
  );
}
