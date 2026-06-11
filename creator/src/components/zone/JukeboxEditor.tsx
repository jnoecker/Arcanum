import type { JukeboxSong } from "@/types/world";
import { FieldRow, TextInput, NumberInput } from "@/components/ui/FormWidgets";
import { AudioTrackPicker } from "@/components/ui/AudioTrackPicker";

interface JukeboxEditorProps {
  songs: JukeboxSong[];
  onChange: (songs: JukeboxSong[]) => void;
}

const EMPTY_SONG: JukeboxSong = {
  title: "",
  file: "",
  durationSeconds: 0,
  cost: 0,
};

export function JukeboxEditor({ songs, onChange }: JukeboxEditorProps) {
  const update = (index: number, patch: Partial<JukeboxSong>) => {
    onChange(songs.map((song, i) => (i === index ? { ...song, ...patch } : song)));
  };

  const add = () => onChange([...songs, { ...EMPTY_SONG }]);

  const remove = (index: number) => onChange(songs.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= songs.length) return;
    const next = [...songs];
    const picked = next[index];
    if (!picked) return;
    next.splice(index, 1);
    next.splice(target, 0, picked);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        Players pay gold to play a song; the room's music locks to that track for its duration,
        then reverts. An empty playlist means the room has no jukebox.
      </p>

      {songs.length === 0 ? (
        <p className="empty-placeholder">No songs in this jukebox</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {songs.map((song, index) => (
            <li
              key={index}
              className="flex flex-col gap-2 rounded-md border border-border-default bg-bg-tertiary/40 p-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-muted">{index + 1}.</span>
                <div className="flex-1">
                  <TextInput
                    value={song.title}
                    onCommit={(v) => update(index, { title: v })}
                    placeholder="Song title"
                    dense
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                    aria-label={`Move ${song.title || `song ${index + 1}`} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                    onClick={() => move(index, 1)}
                    disabled={index === songs.length - 1}
                    title="Move down"
                    aria-label={`Move ${song.title || `song ${index + 1}`} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-status-danger transition-colors hover:bg-status-danger/10"
                    onClick={() => remove(index)}
                    title="Remove song"
                    aria-label={`Remove ${song.title || `song ${index + 1}`}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <FieldRow label="Artist">
                <TextInput
                  value={song.artist ?? ""}
                  onCommit={(v) => update(index, { artist: v || undefined })}
                  placeholder="Optional"
                  dense
                />
              </FieldRow>

              <AudioTrackPicker
                kind="music"
                label="Track"
                value={song.file || undefined}
                onChange={(v) => update(index, { file: v ?? "" })}
                hint="Picked from the music library in the Audio Studio."
              />

              <div className="flex gap-2">
                <FieldRow label="Duration (s)">
                  <NumberInput
                    value={song.durationSeconds || undefined}
                    onCommit={(v) => update(index, { durationSeconds: v ?? 0 })}
                    placeholder="0"
                    min={1}
                    dense
                  />
                </FieldRow>
                <FieldRow label="Cost (gold)">
                  <NumberInput
                    value={song.cost}
                    onCommit={(v) => update(index, { cost: v ?? 0 })}
                    placeholder="0"
                    min={0}
                    dense
                  />
                </FieldRow>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="self-start rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-accent"
        onClick={add}
      >
        + Add song
      </button>
    </div>
  );
}
