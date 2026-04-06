// ─── EffectsEditor ──────────────────────────────────────────────────
// Edits Scene.effects (particles, parallaxLayers, parallaxDepth).
// The Scene.effects field has been on the data model — this exposes it
// in the UI. Particle preset names are advisory; runtime rendering is
// out of scope for this commit.

import { useStoryStore } from "@/stores/storyStore";
import type { Scene, EffectConfig } from "@/types/story";

const PARTICLE_PRESETS: { value: string; label: string }[] = [
  { value: "embers", label: "Embers" },
  { value: "dust", label: "Dust motes" },
  { value: "mist", label: "Drifting mist" },
  { value: "snow", label: "Snowfall" },
  { value: "leaves", label: "Falling leaves" },
  { value: "aurora", label: "Aurora" },
  { value: "sparks", label: "Magic sparks" },
];

interface EffectsEditorProps {
  storyId: string;
  scene: Scene;
}

export function EffectsEditor({ storyId, scene }: EffectsEditorProps) {
  const updateScene = useStoryStore((s) => s.updateScene);
  const fx = scene.effects ?? {};

  const patch = (next: Partial<EffectConfig>) => {
    const merged = { ...fx, ...next };
    // Strip empty/zero values so we don't store noise
    const clean: EffectConfig = {};
    if (merged.particles) clean.particles = merged.particles;
    if (merged.parallaxLayers && merged.parallaxLayers > 0) clean.parallaxLayers = merged.parallaxLayers;
    if (merged.parallaxDepth && merged.parallaxDepth > 0) clean.parallaxDepth = merged.parallaxDepth;
    updateScene(storyId, scene.id, {
      effects: Object.keys(clean).length > 0 ? clean : undefined,
    });
  };

  return (
    <details className="group rounded-lg border border-border-muted bg-bg-primary/50 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-display uppercase tracking-[0.15em] text-text-secondary">
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          className="transform transition-transform group-open:rotate-90"
        >
          <path d="M5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Effects
        {(fx.particles || fx.parallaxLayers) && (
          <span className="ml-2 normal-case tracking-normal text-2xs text-text-muted">
            {[fx.particles, fx.parallaxLayers && `${fx.parallaxLayers}-layer parallax`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </summary>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted">
            Particles
          </label>
          <select
            value={fx.particles ?? ""}
            onChange={(e) => patch({ particles: e.target.value || undefined })}
            className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
          >
            <option value="">— none —</option>
            {PARTICLE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted">
            Parallax layers
          </label>
          <input
            type="number"
            min={0}
            max={5}
            step={1}
            value={fx.parallaxLayers ?? 0}
            onChange={(e) => patch({ parallaxLayers: Number(e.target.value) || undefined })}
            className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted">
            Parallax depth
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={fx.parallaxDepth ?? 0}
            onChange={(e) => patch({ parallaxDepth: Number(e.target.value) || undefined })}
            className="accent-accent"
          />
          <span className="text-2xs text-text-muted">{fx.parallaxDepth ?? 0}%</span>
        </div>
      </div>
    </details>
  );
}
