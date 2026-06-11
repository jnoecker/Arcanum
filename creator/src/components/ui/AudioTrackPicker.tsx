import { useMemo } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useMediaSrc } from "@/lib/useMediaSrc";
import { listAudioTracks, trackLabel, type AudioTrackKind } from "@/lib/audioLibrary";
import { panelTab } from "@/lib/panelRegistry";
import { FieldRow, SelectInput } from "@/components/ui/FormWidgets";

interface AudioTrackPickerProps {
  kind: AudioTrackKind;
  label: string;
  value?: string;
  onChange: (fileName: string | undefined) => void;
  hint?: string;
}

/** Picks a named track from the audio library. Tracks are created in the
 *  Audio Studio; this is assignment-only by design. */
export function AudioTrackPicker({ kind, label, value, onChange, hint }: AudioTrackPickerProps) {
  const assets = useAssetStore((s) => s.assets);
  const openTab = useProjectStore((s) => s.openTab);

  const tracks = useMemo(() => listAudioTracks(assets, kind), [assets, kind]);

  const options = useMemo(() => {
    const opts = tracks.map((t) => ({ value: t.file_name, label: trackLabel(t) }));
    // A value not in the library (hand-entered or from another machine) stays selectable.
    if (value && !tracks.some((t) => t.file_name === value)) {
      opts.unshift({ value, label: value });
    }
    return opts;
  }, [tracks, value]);

  const previewSrc = useMediaSrc(value);

  return (
    <div className="flex flex-col gap-1">
      <FieldRow label={label} hint={hint}>
        <SelectInput
          value={value ?? ""}
          onCommit={(v) => onChange(v || undefined)}
          options={options}
          allowEmpty
          dense
          placeholder="— none —"
        />
      </FieldRow>
      {previewSrc && <audio controls src={previewSrc} className="h-8 w-full" preload="metadata" />}
      {tracks.length === 0 && (
        <p className="text-2xs text-text-muted">
          No {kind} tracks yet —{" "}
          <button
            type="button"
            onClick={() => openTab(panelTab("media"))}
            className="text-accent underline-offset-2 hover:underline"
          >
            open the Audio Studio
          </button>{" "}
          to import or generate some.
        </p>
      )}
    </div>
  );
}
