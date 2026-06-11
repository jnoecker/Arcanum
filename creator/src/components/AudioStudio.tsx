import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useMediaSrc } from "@/lib/useMediaSrc";
import { AI_ENABLED } from "@/lib/featureFlags";
import { getAudioSystemPrompt, getDefaultDuration } from "@/lib/musicPrompts";
import {
  buildUsageIndex,
  listAudioTracks,
  setRoomTrack,
  setZoneDefaultTrack,
  trackLabel,
  usageSummary,
  type AudioTrackKind,
  type TrackUsage,
} from "@/lib/audioLibrary";
import type { AssetEntry, AssetContext } from "@/types/assets";
import { InlineError, Spinner } from "@/components/ui/FormWidgets";

const AUDIO_EXTENSIONS = ["mp3", "ogg", "flac", "wav"];

const LANES: { id: AudioTrackKind; label: string; blurb: string }[] = [
  { id: "music", label: "Music Studio", blurb: "Scores and themes — looping exploration music assigned to zones and rooms." },
  { id: "ambient", label: "Ambient Studio", blurb: "Soundscapes and effects — crickets, rain, tavern murmur — reused anywhere they fit." },
];

function libraryContext(kind: AudioTrackKind): AssetContext {
  return { zone: "", entity_type: "audio_library", entity_id: kind };
}

function nameFromPath(path: string): string {
  const stem = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "";
  return stem.replace(/[-_]+/g, " ").trim();
}

const ELEVENLABS_MAX_SECONDS = 30;

function defaultTrackName(roomTitle: string, kind: AudioTrackKind): string {
  return `${roomTitle} ${kind === "music" ? "Theme" : "Ambience"}`;
}

export function AudioStudio() {
  const assets = useAssetStore((s) => s.assets);
  const importAsset = useAssetStore((s) => s.importAsset);
  const zones = useZoneStore((s) => s.zones);

  const [lane, setLane] = useState<AudioTrackKind>("music");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignTrackId, setAssignTrackId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const tracks = useMemo(() => listAudioTracks(assets, lane), [assets, lane]);
  const usageIndex = useMemo(() => buildUsageIndex(zones.entries()), [zones]);
  const assignTrack = assignTrackId ? tracks.find((t) => t.id === assignTrackId) ?? null : null;
  const laneDef = LANES.find((l) => l.id === lane)!;

  const handleImport = async () => {
    const picked = await open({
      filters: [{ name: "Audio", extensions: AUDIO_EXTENSIONS }],
      multiple: true,
    });
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    setImporting(true);
    setImportError(null);
    try {
      let lastId: string | null = null;
      for (const path of paths) {
        const entry = await importAsset(path, lane, libraryContext(lane), undefined, false, nameFromPath(path));
        lastId = entry.id;
      }
      if (lastId) setSelectedId(lastId);
    } catch (e) {
      setImportError(String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Lane switch */}
      <div className="flex flex-wrap items-center gap-2">
        {LANES.map((l) => (
          <button
            key={l.id}
            onClick={() => { setLane(l.id); setSelectedId(null); }}
            className={`focus-ring rounded-full border px-4 py-2 text-xs font-medium transition ${
              lane === l.id
                ? "border-[var(--border-glow-strong)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.25),rgb(var(--surface-rgb)/0.15))] text-text-primary shadow-glow"
                : "border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] text-text-muted hover:border-[var(--chrome-stroke-strong)] hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
            }`}
          >
            {l.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-text-muted">{tracks.length} track{tracks.length === 1 ? "" : "s"}</span>
          <button
            onClick={handleImport}
            disabled={importing}
            className="focus-ring shell-pill rounded-full px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import tracks"}
          </button>
        </div>
      </div>

      {importError && <InlineError error={importError} onDismiss={() => setImportError(null)} />}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Track library */}
        <section className="panel-surface rounded-3xl p-5">
          <div className="mb-4">
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">{laneDef.label}</p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{laneDef.blurb}</p>
          </div>
          {tracks.length === 0 ? (
            <div className="flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-highlight)] px-4 py-8 text-center">
              <p className="font-display text-base text-text-secondary">An Empty Stage</p>
              <p className="max-w-sm text-xs leading-6 text-text-muted">
                Import audio files or generate a {lane === "music" ? "score" : "soundscape"} to start the library.
                Named tracks can be assigned to any zone or room — and reused everywhere.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  usage={usageIndex.get(track.file_name) ?? { zoneDefaults: [], rooms: [] }}
                  expanded={selectedId === track.id}
                  onToggle={() => setSelectedId(selectedId === track.id ? null : track.id)}
                  onAssign={() => setAssignTrackId(track.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Generator */}
        <GenerateTrackCard key={lane} kind={lane} onCreated={(entry) => setSelectedId(entry.id)} />
      </div>

      {assignTrack && (
        <AssignDialog
          track={assignTrack}
          kind={lane}
          onClose={() => setAssignTrackId(null)}
        />
      )}
    </div>
  );
}

function TrackRow({
  track,
  usage,
  expanded,
  onToggle,
  onAssign,
}: {
  track: AssetEntry;
  usage: TrackUsage;
  expanded: boolean;
  onToggle: () => void;
  onAssign: () => void;
}) {
  const used = usage.zoneDefaults.length > 0 || usage.rooms.length > 0;
  return (
    <div
      className={`rounded-2xl border transition ${
        expanded ? "border-border-active bg-gradient-active" : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] hover:bg-[var(--chrome-highlight)]"
      }`}
    >
      <button onClick={onToggle} className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={expanded}>
        <span className={`text-base ${used ? "text-accent" : "text-text-muted"}`} aria-hidden>♪</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-text-primary">{trackLabel(track)}</div>
          <div className="truncate text-2xs text-text-muted">{usageSummary(usage)}</div>
        </div>
        <svg className={`h-3.5 w-3.5 shrink-0 text-text-muted transition ${expanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {expanded && <TrackDetail track={track} usage={usage} onAssign={onAssign} />}
    </div>
  );
}

function TrackDetail({
  track,
  usage,
  onAssign,
}: {
  track: AssetEntry;
  usage: TrackUsage;
  onAssign: () => void;
}) {
  const renameAsset = useAssetStore((s) => s.renameAsset);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);
  const [name, setName] = useState(track.display_name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = useMediaSrc(track.file_name);

  const used = usage.zoneDefaults.length > 0 || usage.rooms.length > 0;

  const commitName = () => {
    const next = name.trim();
    if (next === track.display_name) return;
    renameAsset(track.id, next).catch((e) => setError(String(e)));
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteAsset(track.id).catch((e) => setError(String(e)));
  };

  return (
    <div className="flex flex-col gap-2.5 border-t border-[var(--chrome-stroke)] px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder={trackLabel(track)}
          aria-label="Track name"
          className="ornate-input min-h-9 flex-1 px-2 py-1 text-xs text-text-primary"
        />
        <span className="font-mono text-3xs text-text-muted" title={track.file_name}>
          {track.file_name.slice(0, 10)}…
        </span>
      </div>

      {src ? <audio controls src={src} className="h-8 w-full" /> : <div className="text-2xs italic text-text-muted">Loading preview…</div>}

      {used && (
        <div className="flex flex-col gap-0.5 text-2xs text-text-muted">
          {usage.zoneDefaults.map((u) => (
            <span key={`${u.zoneId}:${u.kind}`}>Zone default ({u.kind}) — {u.zoneId}</span>
          ))}
          {usage.rooms.slice(0, 6).map((u) => (
            <span key={`${u.zoneId}:${u.roomId}:${u.kind}`}>{u.roomTitle} ({u.zoneId})</span>
          ))}
          {usage.rooms.length > 6 && <span>…and {usage.rooms.length - 6} more rooms</span>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onAssign} className="focus-ring shell-pill-primary rounded-full px-4 py-1.5 text-xs font-medium">
          Assign…
        </button>
        <button
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          className={`focus-ring ml-auto rounded-full px-3 py-1.5 text-xs transition ${
            confirmDelete ? "bg-status-error/20 font-medium text-status-error" : "text-text-muted hover:text-status-error"
          }`}
        >
          {confirmDelete ? (used ? `Used by ${usage.zoneDefaults.length + usage.rooms.length} — delete anyway?` : "Confirm delete") : "Delete"}
        </button>
      </div>

      {error && <InlineError error={error} onDismiss={() => setError(null)} />}
    </div>
  );
}

type AudioProvider = "runware" | "elevenlabs";

function GenerateTrackCard({ kind, onCreated }: { kind: AudioTrackKind; onCreated: (entry: AssetEntry) => void }) {
  const settings = useAssetStore((s) => s.settings);
  const importAsset = useAssetStore((s) => s.importAsset);
  const zones = useZoneStore((s) => s.zones);

  const hasRunwareKey = !!settings && settings.runware_api_key.length > 0;
  const hasElevenKey = !!settings && settings.elevenlabs_api_key.length > 0;
  const hasLlmKey = !!settings && (
    settings.deepinfra_api_key.length > 0 ||
    settings.anthropic_api_key.length > 0 ||
    settings.openrouter_api_key.length > 0 ||
    (settings.use_hub_ai && settings.hub_api_key.length > 0)
  );

  // ElevenLabs sound effects suit ambience, not music.
  const providers: AudioProvider[] = kind === "ambient"
    ? [...(hasElevenKey ? ["elevenlabs" as const] : []), ...(hasRunwareKey ? ["runware" as const] : [])]
    : hasRunwareKey ? ["runware"] : [];

  const [provider, setProvider] = useState<AudioProvider>(providers[0] ?? "runware");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(() =>
    Math.min(getDefaultDuration(kind), providers[0] === "elevenlabs" ? ELEVENLABS_MAX_SECONDS : Infinity),
  );
  const [seamlessLoop, setSeamlessLoop] = useState(true);
  const [ctxZoneId, setCtxZoneId] = useState("");
  const [ctxRoomId, setCtxRoomId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resultSrc = useMediaSrc(resultPath ?? undefined);

  const sortedZones = useMemo(() => [...zones.entries()].sort(([a], [b]) => a.localeCompare(b)), [zones]);
  const ctxZone = ctxZoneId ? zones.get(ctxZoneId) : undefined;
  const roomEntries = useMemo(
    () => Object.entries(ctxZone?.data.rooms ?? {}).sort(([, a], [, b]) => (a.title || "").localeCompare(b.title || "")),
    [ctxZone],
  );
  const ctxRoom = ctxRoomId ? ctxZone?.data.rooms[ctxRoomId] : undefined;

  if (!AI_ENABLED || providers.length === 0) {
    return (
      <section className="panel-surface rounded-3xl p-5">
        <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Generator</p>
        <p className="mt-2 text-xs leading-6 text-text-muted">
          {kind === "ambient"
            ? "Audio generation needs a Runware or ElevenLabs API key. Add one in Settings, or import tracks from disk instead."
            : "Audio generation needs a Runware API key. Add one in Settings, or import tracks from disk instead."}
        </p>
      </section>
    );
  }

  const switchProvider = (next: AudioProvider) => {
    setProvider(next);
    if (next === "elevenlabs") setDuration((d) => Math.min(d, ELEVENLABS_MAX_SECONDS));
  };

  const maxDuration = provider === "elevenlabs" ? ELEVENLABS_MAX_SECONDS : 300;
  const minDuration = provider === "elevenlabs" ? 1 : 10;

  const handleEnhance = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const context = [
        name && `Track name: "${name}"`,
        ctxZone && `Zone: ${ctxZone.data.zone || ctxZoneId}`,
        ctxRoom && `Room: "${ctxRoom.title}"`,
        ctxRoom?.description && `Room description: ${ctxRoom.description}`,
        prompt && `Direction: ${prompt}`,
      ]
        .filter(Boolean)
        .join("\n");
      const enhanced = await invoke<string>("llm_complete", {
        systemPrompt: getAudioSystemPrompt(kind),
        userPrompt: context || "A peaceful fantasy environment",
      });
      setPrompt(enhanced);
    } catch (e) {
      setError(String(e));
    } finally {
      setEnhancing(false);
    }
  };

  const handleInsertRoomText = () => {
    if (!ctxRoom) return;
    setPrompt(ctxRoom.description?.trim() || ctxRoom.title);
    if (!name.trim()) setName(defaultTrackName(ctxRoom.title, kind));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const filePath = provider === "elevenlabs"
        ? await invoke<string>("elevenlabs_generate_sound_effect", {
            text: prompt.trim(),
            durationSeconds: duration,
            seamlessLoop,
          })
        : await invoke<string>("runware_generate_audio", {
            prompt: prompt.trim(),
            durationSeconds: duration,
          });
      setResultPath(filePath);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async () => {
    if (!resultPath) return;
    try {
      const entry = await importAsset(
        resultPath,
        kind,
        libraryContext(kind),
        undefined,
        false,
        name.trim()
          || (ctxRoom ? defaultTrackName(ctxRoom.title, kind) : prompt.trim().slice(0, 48)),
      );
      onCreated(entry);
      setResultPath(null);
      setName("");
      setPrompt("");
    } catch (e) {
      setError(String(e));
    }
  };

  const selectClass = "min-w-0 flex-1 rounded border border-border-default bg-bg-secondary px-2 py-1 text-2xs text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active [&>option]:bg-bg-secondary";

  return (
    <section className="panel-surface flex flex-col gap-2.5 self-start rounded-3xl p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs uppercase tracking-wide-ui text-text-muted">
          {kind === "music" ? "Compose a track" : "Design a soundscape"}
        </p>
        {providers.length > 1 && (
          <div className="flex gap-1" role="group" aria-label="Audio provider">
            {providers.map((p) => (
              <button
                key={p}
                onClick={() => switchProvider(p)}
                className={`focus-ring rounded-full px-2.5 py-0.5 text-2xs transition ${
                  provider === p
                    ? "bg-accent/20 font-medium text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {p === "elevenlabs" ? "ElevenLabs SFX" : "Runware"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Room context — feeds Auto-Prompt and "Use room text" */}
      <div className="flex items-center gap-1.5">
        <select
          value={ctxZoneId}
          onChange={(e) => { setCtxZoneId(e.target.value); setCtxRoomId(""); }}
          aria-label="Context zone"
          className={selectClass}
        >
          <option value="">No zone context</option>
          {sortedZones.map(([zoneId, z]) => (
            <option key={zoneId} value={zoneId}>{z.data.zone || zoneId}</option>
          ))}
        </select>
        <select
          value={ctxRoomId}
          onChange={(e) => setCtxRoomId(e.target.value)}
          disabled={!ctxZoneId}
          aria-label="Context room"
          className={`${selectClass} disabled:opacity-50`}
        >
          <option value="">{ctxZoneId ? "Whole zone" : "Room…"}</option>
          {roomEntries.map(([roomId, room]) => (
            <option key={roomId} value={roomId}>{room.title}</option>
          ))}
        </select>
      </div>
      {ctxRoom && (
        <button
          onClick={handleInsertRoomText}
          className="focus-ring self-start rounded px-1.5 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10"
        >
          Use room text as prompt
        </button>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={kind === "music" ? "Track name — e.g. Tavern Theme" : "Track name — e.g. Crickets at Dusk"}
        aria-label="New track name"
        className="ornate-input min-h-9 w-full px-2 py-1 text-xs text-text-primary"
      />

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder={kind === "ambient" ? "Describe the ambient soundscape…" : "Describe the music…"}
        className="w-full resize-y rounded border border-border-default bg-bg-secondary px-2 py-1 font-mono text-2xs leading-relaxed text-text-secondary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-2xs text-text-muted" htmlFor="audio-studio-duration">Duration</label>
        <input
          id="audio-studio-duration"
          type="number"
          min={minDuration}
          max={maxDuration}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-16 rounded border border-border-default bg-bg-secondary px-1.5 py-0.5 text-2xs text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <span className="text-2xs text-text-muted">sec{provider === "elevenlabs" ? ` (max ${ELEVENLABS_MAX_SECONDS})` : ""}</span>
        {provider === "elevenlabs" && (
          <label className="flex cursor-pointer items-center gap-1 text-2xs text-text-muted">
            <input
              type="checkbox"
              checked={seamlessLoop}
              onChange={(e) => setSeamlessLoop(e.target.checked)}
              className="accent-[rgb(var(--accent-rgb))]"
            />
            Seamless loop
          </label>
        )}
        <div className="ml-auto flex gap-1">
          {hasLlmKey && (
            <button
              onClick={handleEnhance}
              disabled={enhancing}
              className="focus-ring rounded px-1.5 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              {enhancing ? <Spinner /> : "Auto-Prompt"}
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="focus-ring rounded bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
          >
            {generating ? <span className="flex items-center gap-1.5"><Spinner />Generating</span> : "Generate"}
          </button>
        </div>
      </div>

      {resultSrc && resultPath && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-2.5">
          <audio controls src={resultSrc} className="h-8 w-full" />
          <div className="flex gap-1">
            <button onClick={handleAccept} className="focus-ring rounded bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent hover:bg-accent/25">
              Add to library
            </button>
            <button onClick={() => setResultPath(null)} className="focus-ring rounded px-2 py-0.5 text-2xs text-text-muted hover:text-text-secondary">
              Discard
            </button>
          </div>
        </div>
      )}

      {error && <InlineError error={error} onDismiss={() => setError(null)} onRetry={handleGenerate} />}
    </section>
  );
}

function AssignDialog({
  track,
  kind,
  onClose,
}: {
  track: AssetEntry;
  kind: AudioTrackKind;
  onClose: () => void;
}) {
  const zones = useZoneStore((s) => s.zones);
  const updateZone = useZoneStore((s) => s.updateZone);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [openZones, setOpenZones] = useState<Set<string>>(() => new Set(zones.size === 1 ? zones.keys() : []));

  const sortedZones = useMemo(() => [...zones.entries()].sort(([a], [b]) => a.localeCompare(b)), [zones]);
  const file = track.file_name;

  const toggleZoneOpen = (zoneId: string) => {
    setOpenZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-track-title"
        className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-default px-5 py-3">
          <div className="min-w-0">
            <h2 id="assign-track-title" className="truncate font-display text-sm tracking-wide text-text-primary">
              Assign "{trackLabel(track)}"
            </h2>
            <p className="text-2xs text-text-muted">
              {kind === "music" ? "Music" : "Ambient"} slots — zone defaults apply to every room without its own track.
            </p>
          </div>
          <button aria-label="Close" onClick={onClose} className="text-xs text-text-muted hover:text-text-primary">
            &times;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {sortedZones.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-text-muted">No zones loaded.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedZones.map(([zoneId, zoneState]) => {
                const world = zoneState.data;
                const zoneAssigned = world.audio?.[kind] === file;
                const roomEntries = Object.entries(world.rooms).sort(([, a], [, b]) => (a.title || "").localeCompare(b.title || ""));
                const assignedRooms = roomEntries.filter(([, r]) => r[kind] === file).length;
                const isOpen = openZones.has(zoneId);
                return (
                  <div key={zoneId} className="rounded-xl border border-border-default bg-bg-primary">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <button
                        onClick={() => toggleZoneOpen(zoneId)}
                        aria-expanded={isOpen}
                        className="focus-ring flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <svg className={`h-3 w-3 shrink-0 text-text-muted transition ${isOpen ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate text-sm text-text-primary">{world.zone || zoneId}</span>
                        <span className="shrink-0 text-2xs text-text-muted">
                          {assignedRooms > 0 && `${assignedRooms}/${roomEntries.length} rooms`}
                        </span>
                      </button>
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-2xs text-text-secondary">
                        <input
                          type="checkbox"
                          checked={zoneAssigned}
                          onChange={(e) =>
                            updateZone(zoneId, setZoneDefaultTrack(world, kind, e.target.checked ? file : undefined))
                          }
                          className="accent-[rgb(var(--accent-rgb))]"
                        />
                        Zone default
                      </label>
                    </div>
                    {isOpen && (
                      <div className="grid grid-cols-1 gap-x-4 border-t border-border-default px-3 py-2 sm:grid-cols-2">
                        {roomEntries.map(([roomId, room]) => {
                          const checked = room[kind] === file;
                          const other = !checked && !!room[kind];
                          return (
                            <label key={roomId} className="flex cursor-pointer items-center gap-1.5 py-0.5 text-2xs text-text-secondary">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  updateZone(zoneId, setRoomTrack(world, roomId, kind, e.target.checked ? file : undefined))
                                }
                                className="accent-[rgb(var(--accent-rgb))]"
                              />
                              <span className="truncate" title={room.title}>{room.title}</span>
                              {other && <span className="shrink-0 text-3xs text-text-muted" title={`Currently: ${room[kind]}`}>≠</span>}
                            </label>
                          );
                        })}
                        {roomEntries.length === 0 && <p className="py-1 text-2xs italic text-text-muted">No rooms.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-border-default px-5 py-3">
          <button onClick={onClose} className="focus-ring shell-pill rounded-full px-4 py-1.5 text-xs font-medium">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
