import type { PuzzleFile, WorldFile } from "@/types/world";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useImageSrc } from "@/lib/useImageSrc";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";

interface PuzzleBackgroundEditorProps {
  world: WorldFile;
  puzzleId: string;
  puzzle: PuzzleFile;
  onPatch: (p: Partial<PuzzleFile>) => void;
}

const FRAMING =
  "Wide landscape backdrop, an open grimoire/codex page with a clean flat blank center where the riddle and answer overlay on top, decorative gilt margins, no writing, no readable text, no figures.";

/**
 * Appearance editor for a puzzle's optional backdrop — the "Conundrum Codex"
 * tome the web client renders behind the riddle. The question text and answer
 * input sit on top. Falls back to the world-default `puzzle_bg` global asset,
 * then a procedural tome page, when unset.
 */
export function PuzzleBackgroundEditor({
  world,
  puzzleId,
  puzzle,
  onPatch,
}: PuzzleBackgroundEditorProps) {
  const globalAssets = useConfigStore((s) => s.config?.globalAssets);
  const resolved = puzzle.backgroundImage || globalAssets?.puzzle_bg || undefined;
  const usingDefault = !puzzle.backgroundImage && !!resolved;
  const previewSrc = useImageSrc(resolved);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-border-muted bg-bg-tertiary/50"
          aria-label="Puzzle background preview"
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-2xs italic text-text-muted">
              No background art — generate below, set a world default in Global Assets (puzzle_bg), or leave blank for the CSS tome fallback
            </div>
          )}
        </div>
        {usingDefault && (
          <span className="text-center text-2xs italic text-text-muted">
            Using world default (puzzle_bg)
          </span>
        )}
      </div>

      <EntityArtGenerator
        assetType="background"
        surface="worldbuilding"
        currentImage={puzzle.backgroundImage}
        onAccept={(fileName) => onPatch({ backgroundImage: fileName })}
        getPrompt={(_style: ArtStyle) => FRAMING}
        entityContext={`A backdrop for a riddle puzzle — an open grimoire or codex page with a clear central area where the riddle text and the player's answer overlay. Scholarly, painterly, on-brand.`}
        framingHint={FRAMING}
        context={{
          zone: world.zone,
          entity_type: "puzzle_bg",
          entity_id: puzzleId,
        }}
      />
    </div>
  );
}
