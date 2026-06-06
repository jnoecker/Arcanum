import { useEffect, useMemo, useRef, useState } from "react";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { panelTab } from "@/lib/panelRegistry";
import {
  ELEVENLABS_DEFAULT_SETTINGS,
  ELEVENLABS_MODELS,
  lineKey,
  resolveVoiceSettings,
  settingsAreEmpty,
  sha8,
  VOICE_SETTING_FIELDS,
  type DialogueLine,
  type ElevenLabsVoice,
  type VoiceMap,
  type VoiceSettings,
} from "@/types/voiceover";

interface MobGroup {
  zone: string;
  templateKey: string;
  mobName: string;
  lineCount: number;
}

/** Fill any unset setting with the ElevenLabs default so sliders always have a
 *  concrete value to display. */
function effectiveSettings(s: VoiceSettings): Required<VoiceSettings> {
  return {
    stability: s.stability ?? ELEVENLABS_DEFAULT_SETTINGS.stability,
    similarityBoost: s.similarityBoost ?? ELEVENLABS_DEFAULT_SETTINGS.similarityBoost,
    style: s.style ?? ELEVENLABS_DEFAULT_SETTINGS.style,
    useSpeakerBoost: s.useSpeakerBoost ?? ELEVENLABS_DEFAULT_SETTINGS.useSpeakerBoost,
    speed: s.speed ?? ELEVENLABS_DEFAULT_SETTINGS.speed,
  };
}

/** Flatten every voiceable NPC dialogue line across all loaded zones. */
function collectLines(zones: Map<string, { data: import("@/types/world").WorldFile }>): DialogueLine[] {
  const lines: DialogueLine[] = [];
  for (const { data } of zones.values()) {
    const zone = data.zone;
    const mobs = data.mobs ?? {};
    for (const [templateKey, mob] of Object.entries(mobs)) {
      const dialogue = mob.dialogue;
      if (!dialogue) continue;
      for (const [nodeId, node] of Object.entries(dialogue)) {
        if (!node.text || !node.text.trim()) continue;
        lines.push({ zone, templateKey, mobName: mob.name ?? templateKey, nodeId, text: node.text });
      }
    }
  }
  lines.sort((a, b) => {
    if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
    if (a.templateKey !== b.templateKey) return a.templateKey.localeCompare(b.templateKey);
    if (a.nodeId === "root") return -1;
    if (b.nodeId === "root") return 1;
    return a.nodeId.localeCompare(b.nodeId);
  });
  return lines;
}

export default function VoiceOverPanel() {
  const zones = useZoneStore((s) => s.zones);
  const projectDir = useProjectStore((s) => s.project?.mudDir);

  const openTab = useProjectStore((s) => s.openTab);

  const settings = useAssetStore((s) => s.settings);
  const loadSettings = useAssetStore((s) => s.loadSettings);

  const voiceMap = useVoiceStore((s) => s.voiceMap);
  const voices = useVoiceStore((s) => s.voices);
  const loadingVoices = useVoiceStore((s) => s.loadingVoices);
  const voicesError = useVoiceStore((s) => s.voicesError);
  const results = useVoiceStore((s) => s.results);
  const generating = useVoiceStore((s) => s.generating);
  const publishing = useVoiceStore((s) => s.publishing);
  const lastPublish = useVoiceStore((s) => s.lastPublish);

  const mapLoaded = useVoiceStore((s) => s.mapLoaded);
  const loadVoiceMap = useVoiceStore((s) => s.loadVoiceMap);
  const saveVoiceMap = useVoiceStore((s) => s.saveVoiceMap);
  const rehydrate = useVoiceStore((s) => s.rehydrate);
  const ensureClipDataUrl = useVoiceStore((s) => s.ensureClipDataUrl);
  const setDefaultVoice = useVoiceStore((s) => s.setDefaultVoice);
  const setModel = useVoiceStore((s) => s.setModel);
  const setAssignment = useVoiceStore((s) => s.setAssignment);
  const setDefaultSettings = useVoiceStore((s) => s.setDefaultSettings);
  const clearDefaultSettings = useVoiceStore((s) => s.clearDefaultSettings);
  const setMobSettings = useVoiceStore((s) => s.setMobSettings);
  const clearMobSettings = useVoiceStore((s) => s.clearMobSettings);
  const resolveVoiceId = useVoiceStore((s) => s.resolveVoiceId);
  const fetchVoices = useVoiceStore((s) => s.fetchVoices);
  const synthesizeLine = useVoiceStore((s) => s.synthesizeLine);
  const generateAll = useVoiceStore((s) => s.generateAll);
  const publishToR2 = useVoiceStore((s) => s.publishToR2);

  const [savingMap, setSavingMap] = useState(false);
  const [savedMap, setSavedMap] = useState(false);
  const [sha8Map, setSha8Map] = useState<Record<string, string>>({});

  const hasKey = !!settings?.elevenlabs_api_key;
  const r2Configured = !!(
    settings?.r2_account_id &&
    settings?.r2_access_key_id &&
    settings?.r2_secret_access_key &&
    settings?.r2_bucket
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (projectDir) loadVoiceMap();
  }, [projectDir, loadVoiceMap]);

  useEffect(() => {
    if (hasKey && voices.length === 0 && !loadingVoices && !voicesError) {
      fetchVoices();
    }
  }, [hasKey, voices.length, loadingVoices, voicesError, fetchVoices]);

  const lines = useMemo(() => collectLines(zones), [zones]);

  const mobGroups = useMemo<MobGroup[]>(() => {
    const map = new Map<string, MobGroup>();
    for (const line of lines) {
      const key = `${line.zone} ${line.templateKey}`;
      const existing = map.get(key);
      if (existing) {
        existing.lineCount += 1;
      } else {
        map.set(key, { zone: line.zone, templateKey: line.templateKey, mobName: line.mobName, lineCount: 1 });
      }
    }
    return [...map.values()];
  }, [lines]);

  // Compute the contract hash of each line's current text so we can flag
  // clips that were generated against an older version of the line.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const line of lines) {
        next[lineKey(line.zone, line.templateKey, line.nodeId)] = await sha8(line.text);
      }
      if (!cancelled) setSha8Map(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [lines]);

  // Auto-save the voice map shortly after any change so assignments and
  // settings survive closing the panel or restarting the app. Gated on
  // mapLoaded so we never persist the empty default over a real saved file
  // before the on-disk map has loaded.
  useEffect(() => {
    if (!projectDir || !mapLoaded) return;
    const t = setTimeout(() => {
      saveVoiceMap().catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [voiceMap, projectDir, mapLoaded, saveVoiceMap]);

  // Final flush on unmount, so an edit made within the debounce window is still
  // persisted if the panel closes immediately after.
  useEffect(() => {
    return () => {
      const s = useVoiceStore.getState();
      if (s.mapLoaded) s.saveVoiceMap().catch(() => {});
    };
  }, []);

  // Restore "already generated" status from the on-disk clip cache whenever the
  // lines or voice config change. Debounced so slider drags don't spam queries.
  useEffect(() => {
    if (!lines.length) return;
    const t = setTimeout(() => {
      rehydrate(lines).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [lines, voiceMap, rehydrate]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playClip = (dataUrl: string) => {
    audioRef.current?.pause();
    const audio = new Audio(dataUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});
  };
  const handlePlay = async (key: string) => {
    const url = await ensureClipDataUrl(key);
    if (url) playClip(url);
  };

  const voiceName = (voiceId: string) => voices.find((v) => v.voiceId === voiceId)?.name ?? voiceId;

  const doneCount = useMemo(() => {
    let n = 0;
    for (const line of lines) {
      const st = results.get(lineKey(line.zone, line.templateKey, line.nodeId));
      if (st?.status === "done") n += 1;
    }
    return n;
  }, [lines, results]);

  const errorSummary = useMemo(() => {
    let count = 0;
    let firstMessage = "";
    for (const line of lines) {
      const st = results.get(lineKey(line.zone, line.templateKey, line.nodeId));
      if (st?.status === "error") {
        count += 1;
        if (!firstMessage && st.error) firstMessage = st.error;
      }
    }
    return { count, firstMessage };
  }, [lines, results]);

  const handleSaveMap = async () => {
    setSavingMap(true);
    try {
      await saveVoiceMap();
      setSavedMap(true);
      setTimeout(() => setSavedMap(false), 2000);
    } finally {
      setSavingMap(false);
    }
  };

  // ─── Guards ──────────────────────────────────────────────────────
  if (!projectDir) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-6 py-10 text-sm text-text-muted">
        Open a world project to generate dialogue voice-overs.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-y-auto px-6 py-6">
      {/* Header */}
      <header>
        <h2 className="font-display text-lg uppercase tracking-widest text-text-primary">
          Dialogue Voice-Over
        </h2>
        <p className="mt-1 max-w-3xl text-2xs leading-5 text-text-muted">
          Synthesize spoken audio for every NPC dialogue line with ElevenLabs and publish the clips
          to your CDN. The web client plays them as players talk to NPCs; telnet is unaffected.
          Choices stay text-only.
        </p>
      </header>

      {/* API key warning */}
      {!hasKey && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 px-4 py-3 text-2xs leading-5 text-status-warning">
          No ElevenLabs API key configured. Add one in{" "}
          <button
            className="underline underline-offset-2 hover:text-text-primary"
            onClick={() => openTab(panelTab("services"))}
          >
            Settings → Services
          </button>{" "}
          to fetch voices and synthesize audio.
        </div>
      )}

      {/* ─── Voice assignment ─────────────────────────────────────── */}
      <section className="rounded-xl border border-border-default bg-bg-secondary/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-sm uppercase tracking-widest text-text-primary">
            Voices
          </h3>
          <div className="flex items-center gap-2">
            {savedMap && <span className="text-2xs text-status-success">Saved</span>}
            <button
              onClick={handleSaveMap}
              disabled={savingMap}
              className="action-button action-button-secondary action-button-sm focus-ring"
            >
              {savingMap ? "Saving…" : "Save voices"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-wider text-text-muted">Default voice</span>
            <select
              value={voiceMap.defaultVoiceId}
              onChange={(e) => setDefaultVoice(e.target.value)}
              disabled={!voices.length}
              className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            >
              <option value="">{loadingVoices ? "Loading voices…" : "— select —"}</option>
              {voices.map((v) => (
                <option key={v.voiceId} value={v.voiceId}>
                  {v.name}
                  {v.category ? ` (${v.category})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-wider text-text-muted">Model</span>
            <select
              value={voiceMap.modelId}
              onChange={(e) => setModel(e.target.value)}
              className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            >
              {ELEVENLABS_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Project-wide delivery defaults */}
        <details className="mt-3 rounded border border-border-muted bg-bg-primary px-3 py-2">
          <summary className="cursor-pointer select-none text-2xs uppercase tracking-wider text-text-muted">
            Default delivery
            {!settingsAreEmpty(voiceMap.defaultSettings) && (
              <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 text-3xs normal-case tracking-normal text-accent">
                customized
              </span>
            )}
          </summary>
          <div className="mt-2">
            <VoiceSettingsEditor
              effective={effectiveSettings(voiceMap.defaultSettings)}
              onSet={(field, value) =>
                setDefaultSettings({ [field]: value } as Partial<VoiceSettings>)
              }
              onReset={clearDefaultSettings}
              canReset={!settingsAreEmpty(voiceMap.defaultSettings)}
            />
          </div>
        </details>

        {voicesError && (
          <p className="mt-2 text-2xs text-status-error">Couldn't load voices: {voicesError}</p>
        )}

        {/* Per-mob assignment */}
        {mobGroups.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
              Per-NPC voices ({mobGroups.length} speaking{" "}
              {mobGroups.length === 1 ? "NPC" : "NPCs"})
            </p>
            <ul className="flex flex-col gap-1.5">
              {mobGroups.map((g) => (
                <MobAssignmentRow
                  key={`${g.zone} ${g.templateKey}`}
                  group={g}
                  voices={voices}
                  voiceMap={voiceMap}
                  defaultVoiceLabel={voiceMap.defaultVoiceId ? voiceName(voiceMap.defaultVoiceId) : ""}
                  onAssign={(voiceId) => setAssignment(g.templateKey, voiceId)}
                  onSet={(field, value) =>
                    setMobSettings(g.templateKey, { [field]: value } as Partial<VoiceSettings>)
                  }
                  onReset={() => clearMobSettings(g.templateKey)}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ─── Generation ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-border-default bg-bg-secondary/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm uppercase tracking-widest text-text-primary">
            Lines{" "}
            <span className="ml-1 text-2xs font-normal normal-case tracking-normal text-text-muted">
              {doneCount}/{lines.length} generated
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => generateAll(lines)}
              disabled={!hasKey || generating || lines.length === 0}
              className="action-button action-button-primary action-button-sm focus-ring"
            >
              {generating ? "Generating…" : "Generate all"}
            </button>
            <button
              onClick={() => publishToR2(lines)}
              disabled={!r2Configured || publishing || doneCount === 0}
              title={r2Configured ? undefined : "Configure Cloudflare R2 in Settings to publish."}
              className="action-button action-button-secondary action-button-sm focus-ring"
            >
              {publishing ? "Publishing…" : "Publish to R2"}
            </button>
          </div>
        </div>

        {lastPublish && (
          <div className="mb-3 rounded border border-border-muted bg-bg-primary px-3 py-2 text-2xs text-text-muted">
            Published: {lastPublish.uploaded} uploaded, {lastPublish.skipped} unchanged,{" "}
            {lastPublish.failed} failed.
            {lastPublish.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-status-error">
                {lastPublish.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {errorSummary.count > 0 && (
          <div className="mb-3 rounded border border-status-error/30 bg-status-error/5 px-3 py-2 text-2xs text-status-error">
            {errorSummary.count} line{errorSummary.count !== 1 ? "s" : ""} failed to generate.
            {errorSummary.firstMessage && (
              <span className="mt-1 block break-words font-mono text-3xs opacity-90">
                {errorSummary.firstMessage}
              </span>
            )}
          </div>
        )}

        {lines.length === 0 ? (
          <p className="rounded border border-dashed border-border-muted bg-bg-primary px-3 py-6 text-center text-2xs italic text-text-muted/70">
            No NPC dialogue found in the loaded zones. Add dialogue to a mob, then return here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {lines.map((line) => {
              const key = lineKey(line.zone, line.templateKey, line.nodeId);
              const st = results.get(key);
              const clip = st?.clip;
              const stale = clip ? sha8Map[key] !== undefined && sha8Map[key] !== clip.textSha8 : false;
              const effectiveVoice = resolveVoiceId(line.templateKey);
              return (
                <li
                  key={key}
                  className="flex items-center gap-2 rounded border border-border-muted bg-bg-primary px-2.5 py-1.5"
                >
                  <div className="w-44 shrink-0">
                    <div className="truncate text-xs text-text-primary">{line.mobName}</div>
                    <div className="truncate font-mono text-3xs text-text-muted/70">
                      {line.zone} · {line.nodeId}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-2xs text-text-secondary" title={line.text}>
                      {line.text}
                    </div>
                    {st?.status === "error" && st.error && (
                      <div className="truncate text-3xs text-status-error" title={st.error}>
                        {st.error}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={st?.status ?? "idle"} stale={stale} error={st?.error} />
                  {clip && (
                    <button
                      onClick={() => handlePlay(key)}
                      className="focus-ring inline-flex h-6 w-6 items-center justify-center rounded border border-border-default text-xs text-text-muted transition hover:bg-bg-tertiary hover:text-text-primary"
                      title="Play preview"
                      aria-label={`Play ${line.mobName} ${line.nodeId}`}
                    >
                      ▶
                    </button>
                  )}
                  <button
                    onClick={() => synthesizeLine(line)}
                    disabled={!hasKey || !effectiveVoice || st?.status === "generating"}
                    className="focus-ring shrink-0 rounded border border-border-default px-2 py-0.5 text-3xs text-text-muted transition hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-40"
                    title={effectiveVoice ? "Generate this line" : "Assign a voice first"}
                  >
                    {clip ? "Regenerate" : "Generate"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

interface MobAssignmentRowProps {
  group: MobGroup;
  voices: ElevenLabsVoice[];
  voiceMap: VoiceMap;
  defaultVoiceLabel: string;
  onAssign: (voiceId: string) => void;
  onSet: (field: keyof VoiceSettings, value: number | boolean) => void;
  onReset: () => void;
}

function MobAssignmentRow({
  group,
  voices,
  voiceMap,
  defaultVoiceLabel,
  onAssign,
  onSet,
  onReset,
}: MobAssignmentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const assigned = voiceMap.assignments[group.templateKey] ?? "";
  const customized = !settingsAreEmpty(voiceMap.settings[group.templateKey]);
  const effective = effectiveSettings(resolveVoiceSettings(voiceMap, group.templateKey));

  return (
    <li className="rounded border border-border-muted bg-bg-primary">
      <div className="flex items-center gap-3 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <span className="text-xs text-text-primary">{group.mobName}</span>
          <span className="ml-2 font-mono text-3xs text-text-muted/70">
            {group.zone}:{group.templateKey} · {group.lineCount} line
            {group.lineCount !== 1 ? "s" : ""}
          </span>
        </div>
        <select
          value={assigned}
          onChange={(e) => onAssign(e.target.value)}
          disabled={!voices.length}
          className="w-48 rounded border border-border-default bg-bg-secondary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
        >
          <option value="">Default{defaultVoiceLabel ? ` (${defaultVoiceLabel})` : ""}</option>
          {voices.map((v) => (
            <option key={v.voiceId} value={v.voiceId}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setExpanded((x) => !x)}
          aria-expanded={expanded}
          title="Delivery settings"
          className={`focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs transition ${
            customized
              ? "border-accent/40 text-accent hover:bg-accent/10"
              : "border-border-default text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
          }`}
        >
          &#x2699;
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border-muted px-2.5 py-2">
          <VoiceSettingsEditor
            effective={effective}
            onSet={onSet}
            onReset={onReset}
            canReset={customized}
          />
        </div>
      )}
    </li>
  );
}

interface VoiceSettingsEditorProps {
  effective: Required<VoiceSettings>;
  onSet: (field: keyof VoiceSettings, value: number | boolean) => void;
  onReset: () => void;
  canReset: boolean;
}

function VoiceSettingsEditor({ effective, onSet, onReset, canReset }: VoiceSettingsEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      {VOICE_SETTING_FIELDS.map((f) => (
        <div key={f.key} className="flex items-center gap-2">
          <label className="w-20 shrink-0 text-2xs text-text-muted" title={f.hint}>
            {f.label}
          </label>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={effective[f.key] as number}
            onChange={(e) => onSet(f.key, parseFloat(e.target.value))}
            className="h-1.5 flex-1 accent-accent"
            aria-label={f.label}
          />
          <span className="w-9 shrink-0 text-right font-mono text-3xs text-text-secondary">
            {(effective[f.key] as number).toFixed(2)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-text-muted">
          <input
            type="checkbox"
            checked={effective.useSpeakerBoost}
            onChange={(e) => onSet("useSpeakerBoost", e.target.checked)}
            className="accent-accent"
          />
          Speaker boost
        </label>
        <button
          onClick={onReset}
          disabled={!canReset}
          className="focus-ring rounded border border-border-default px-2 py-0.5 text-3xs text-text-muted transition hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-40"
          title="Clear overrides for this scope"
        >
          Reset
        </button>
      </div>
      <p className="text-3xs text-text-muted/60">Unset values fall back to ElevenLabs defaults.</p>
    </div>
  );
}

function StatusBadge({
  status,
  stale,
  error,
}: {
  status: "idle" | "generating" | "done" | "error";
  stale: boolean;
  error?: string;
}) {
  if (status === "generating") {
    return <span className="shrink-0 text-3xs uppercase tracking-ui text-accent">working…</span>;
  }
  if (status === "error") {
    return (
      <span className="shrink-0 text-3xs uppercase tracking-ui text-status-error" title={error}>
        error
      </span>
    );
  }
  if (status === "done") {
    return stale ? (
      <span className="shrink-0 text-3xs uppercase tracking-ui text-status-warning" title="Line edited since this clip was generated — regenerate.">
        edited
      </span>
    ) : (
      <span className="shrink-0 text-3xs uppercase tracking-ui text-status-success">ready</span>
    );
  }
  return <span className="shrink-0 text-3xs uppercase tracking-ui text-text-muted/50">—</span>;
}
