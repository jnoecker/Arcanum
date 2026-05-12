import { useEffect, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import type { Article } from "@/types/lore";
import type {
  AbilityDefinitionConfig,
  AppConfig,
  ClassDefinitionConfig,
  RaceDefinitionConfig,
} from "@/types/config";
import {
  generateClassFromArticle,
  generateCreaturePowerFromArticle,
  generateRaceFromArticle,
  generateTalentFromArticle,
  type AbilityScaffoldResult,
  type ClassScaffoldResult,
  type RaceScaffoldResult,
} from "@/lib/articleToGameplay";

type Kind = "class" | "race" | "talent" | "creature_power";

interface ScaffoldGameplayDialogProps {
  kind: Kind;
  article: Article;
  config: AppConfig;
  onAccept: (next: AppConfig) => void;
  onClose: () => void;
}

export function ScaffoldGameplayDialog(props: ScaffoldGameplayDialogProps) {
  if (props.kind === "class") return <ClassScaffold {...props} />;
  if (props.kind === "race") return <RaceScaffold {...props} />;
  return <AbilityScaffold {...props} />;
}

// ─── Class ──────────────────────────────────────────────────────────

function ClassScaffold({ article, config, onAccept, onClose }: ScaffoldGameplayDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ClassScaffoldResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState("");
  const [draft, setDraft] = useState<ClassDefinitionConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    generateClassFromArticle({
      article,
      existingClassIds: new Set(Object.keys(config.classes ?? {}).map((s) => s.toLowerCase())),
      existingClassDisplayNames: new Set(
        Object.values(config.classes ?? {}).map((c) => c.displayName.toLowerCase()),
      ),
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setId(r.id);
        setDraft(r.config);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [article, config.classes]);

  const collision =
    !!id &&
    (Object.keys(config.classes ?? {}).some((k) => k.toLowerCase() === id.toLowerCase()) ||
      Object.values(config.classes ?? {}).some(
        (c) => c.displayName.toLowerCase() === draft?.displayName.toLowerCase(),
      ));

  const handleAccept = () => {
    if (!draft || !id || collision) return;
    const nextClasses = { ...(config.classes ?? {}), [id]: draft };
    onAccept({ ...config, classes: nextClasses });
    onClose();
  };

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="scaffold-class-title"
      title="Scaffold Gameplay Class from Article"
      subtitle={article.title}
      widthClassName="max-w-3xl"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            onClick={handleAccept}
            disabled={loading || !draft || !id || collision}
          >
            Add to Classes
          </ActionButton>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-3 py-8 text-sm text-text-secondary">
          <Spinner /> Reading the article and synthesizing the class…
        </div>
      ) : error ? (
        <p className="text-sm text-status-error">{error}</p>
      ) : result && draft ? (
        <div className="flex flex-col gap-3">
          <RetrievalBanner sources={result.diagnostic.sources.length} usedRag={result.diagnostic.usedRag} />
          {collision && (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/[0.06] px-3 py-2 text-xs text-status-warning">
              A class with this id or display name already exists. Edit the id or display name before accepting.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Id (slug)">
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-xs"
              />
            </Field>
            <Field label="Display name">
              <input
                type="text"
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                className="ornate-input w-full px-2.5 py-1.5 text-sm"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined })}
              rows={2}
              className="ornate-input w-full px-2.5 py-1.5 text-sm"
            />
          </Field>

          <Field label="Backstory">
            <textarea
              value={draft.backstory ?? ""}
              onChange={(e) => setDraft({ ...draft, backstory: e.target.value || undefined })}
              rows={6}
              className="ornate-input w-full px-2.5 py-1.5 text-sm leading-relaxed"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="HP per level">
              <input
                type="number"
                value={draft.hpPerLevel}
                onChange={(e) => setDraft({ ...draft, hpPerLevel: Number(e.target.value) || 0 })}
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-sm"
              />
            </Field>
            <Field label="Mana per level">
              <input
                type="number"
                value={draft.manaPerLevel}
                onChange={(e) => setDraft({ ...draft, manaPerLevel: Number(e.target.value) || 0 })}
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-sm"
              />
            </Field>
            <Field label="Primary stat">
              <input
                type="text"
                value={draft.primaryStat ?? ""}
                onChange={(e) => setDraft({ ...draft, primaryStat: e.target.value || undefined })}
                className="ornate-input w-full px-2.5 py-1.5 text-sm"
              />
            </Field>
          </div>

          <Field label="Outfit description (for sprite generation)">
            <textarea
              value={draft.outfitDescription ?? ""}
              onChange={(e) => setDraft({ ...draft, outfitDescription: e.target.value || undefined })}
              rows={3}
              className="ornate-input w-full px-2.5 py-1.5 text-sm"
            />
          </Field>

          {result.suggestedAbilities.length > 0 && (
            <Field label="Suggested abilities (build these next)">
              <ul className="flex flex-wrap gap-1.5">
                {result.suggestedAbilities.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-2xs text-accent"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </div>
      ) : null}
    </DialogShell>
  );
}

// ─── Race ───────────────────────────────────────────────────────────

function RaceScaffold({ article, config, onAccept, onClose }: ScaffoldGameplayDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RaceScaffoldResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState("");
  const [draft, setDraft] = useState<RaceDefinitionConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    generateRaceFromArticle({
      article,
      existingRaceIds: new Set(Object.keys(config.races ?? {}).map((s) => s.toLowerCase())),
      existingRaceDisplayNames: new Set(
        Object.values(config.races ?? {}).map((r) => r.displayName.toLowerCase()),
      ),
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setId(r.id);
        setDraft(r.config);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [article, config.races]);

  const collision =
    !!id &&
    (Object.keys(config.races ?? {}).some((k) => k.toLowerCase() === id.toLowerCase()) ||
      Object.values(config.races ?? {}).some(
        (r) => r.displayName.toLowerCase() === draft?.displayName.toLowerCase(),
      ));

  const handleAccept = () => {
    if (!draft || !id || collision) return;
    const nextRaces = { ...(config.races ?? {}), [id]: draft };
    onAccept({ ...config, races: nextRaces });
    onClose();
  };

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="scaffold-race-title"
      title="Scaffold Gameplay Race from Article"
      subtitle={article.title}
      widthClassName="max-w-3xl"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            onClick={handleAccept}
            disabled={loading || !draft || !id || collision}
          >
            Add to Races
          </ActionButton>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-3 py-8 text-sm text-text-secondary">
          <Spinner /> Reading the article and synthesizing the race…
        </div>
      ) : error ? (
        <p className="text-sm text-status-error">{error}</p>
      ) : result && draft ? (
        <div className="flex flex-col gap-3">
          <RetrievalBanner sources={result.diagnostic.sources.length} usedRag={result.diagnostic.usedRag} />
          {collision && (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/[0.06] px-3 py-2 text-xs text-status-warning">
              A race with this id or display name already exists. Edit the id or display name before accepting.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Id (slug)">
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-xs"
              />
            </Field>
            <Field label="Display name">
              <input
                type="text"
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                className="ornate-input w-full px-2.5 py-1.5 text-sm"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined })}
              rows={2}
              className="ornate-input w-full px-2.5 py-1.5 text-sm"
            />
          </Field>

          <Field label="Backstory">
            <textarea
              value={draft.backstory ?? ""}
              onChange={(e) => setDraft({ ...draft, backstory: e.target.value || undefined })}
              rows={6}
              className="ornate-input w-full px-2.5 py-1.5 text-sm leading-relaxed"
            />
          </Field>

          <Field label="Body description (physical, for sprite generation — no clothing)">
            <textarea
              value={draft.bodyDescription ?? ""}
              onChange={(e) => setDraft({ ...draft, bodyDescription: e.target.value || undefined })}
              rows={3}
              className="ornate-input w-full px-2.5 py-1.5 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Traits">
              <ChipList
                values={draft.traits ?? []}
                onChange={(v) => setDraft({ ...draft, traits: v.length > 0 ? v : undefined })}
                placeholder="Add a trait…"
              />
            </Field>
            <Field label="Signature abilities">
              <ChipList
                values={draft.abilities ?? []}
                onChange={(v) => setDraft({ ...draft, abilities: v.length > 0 ? v : undefined })}
                placeholder="Add an ability…"
              />
            </Field>
          </div>

          <Field label="Stat mods (-2..+2)">
            <StatModEditor
              statMods={draft.statMods ?? {}}
              onChange={(s) => setDraft({ ...draft, statMods: Object.keys(s).length > 0 ? s : undefined })}
            />
          </Field>
        </div>
      ) : null}
    </DialogShell>
  );
}

// ─── Shared widgets ─────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function RetrievalBanner({ sources, usedRag }: { sources: number; usedRag: boolean }) {
  if (!usedRag) {
    return (
      <div className="rounded-lg border border-status-warning/30 bg-status-warning/[0.06] px-3 py-2 text-xs text-status-warning">
        Synthesized from the article alone — no lore index context available.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/[0.05] px-3 py-2 text-xs text-text-secondary">
      Synthesized from the article plus <span className="text-accent">{sources} retrieved lore source{sources === 1 ? "" : "s"}</span>.
    </div>
  );
}

function ChipList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const next = draft.trim();
    if (!next) return;
    if (values.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...values, next]);
    setDraft("");
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-0.5 text-2xs text-text-secondary"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="text-text-muted transition hover:text-status-error"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="ornate-input w-full px-2 py-1 text-2xs"
      />
    </div>
  );
}

function AbilityScaffold({ kind, article, config, onAccept, onClose }: ScaffoldGameplayDialogProps) {
  const isCreature = kind === "creature_power";
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AbilityScaffoldResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState("");
  const [draft, setDraft] = useState<AbilityDefinitionConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const opts = {
      article,
      existingAbilityIds: new Set(Object.keys(config.abilities ?? {}).map((s) => s.toLowerCase())),
      existingAbilityDisplayNames: new Set(
        Object.values(config.abilities ?? {}).map((a) => a.displayName.toLowerCase()),
      ),
    };
    const promise = isCreature
      ? generateCreaturePowerFromArticle(opts)
      : generateTalentFromArticle(opts);
    promise
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setId(r.id);
        setDraft(r.config);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [article, config.abilities, isCreature]);

  const collision =
    !!id &&
    (Object.keys(config.abilities ?? {}).some((k) => k.toLowerCase() === id.toLowerCase()) ||
      Object.values(config.abilities ?? {}).some(
        (a) => a.displayName.toLowerCase() === draft?.displayName.toLowerCase(),
      ));

  const handleAccept = () => {
    if (!draft || !id || collision) return;
    const nextAbilities = { ...(config.abilities ?? {}), [id]: draft };
    onAccept({ ...config, abilities: nextAbilities });
    onClose();
  };

  const title = isCreature
    ? "Scaffold Creature Power from Article"
    : "Scaffold Player Talent from Article";
  const acceptLabel = isCreature ? "Add Creature Power" : "Add Talent";

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="scaffold-ability-title"
      title={title}
      subtitle={article.title}
      widthClassName="max-w-3xl"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            onClick={handleAccept}
            disabled={loading || !draft || !id || collision}
          >
            {acceptLabel}
          </ActionButton>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-3 py-8 text-sm text-text-secondary">
          <Spinner /> Reading the article and synthesizing the ability…
        </div>
      ) : error ? (
        <p className="text-sm text-status-error">{error}</p>
      ) : result && draft ? (
        <div className="flex flex-col gap-3">
          <RetrievalBanner sources={result.diagnostic.sources.length} usedRag={result.diagnostic.usedRag} />
          {collision && (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/[0.06] px-3 py-2 text-xs text-status-warning">
              An ability with this id or display name already exists. Edit the id or display name before accepting.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Id (slug)">
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-xs"
              />
            </Field>
            <Field label="Display name">
              <input
                type="text"
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                className="ornate-input w-full px-2.5 py-1.5 text-sm"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined })}
              rows={2}
              className="ornate-input w-full px-2.5 py-1.5 text-sm"
            />
          </Field>

          {!isCreature && (
            <Field label="Required class (id)">
              <input
                type="text"
                value={draft.requiredClass ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, requiredClass: e.target.value || undefined })
                }
                placeholder="e.g. wizard, paladin"
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-xs"
              />
            </Field>
          )}

          <div className="grid grid-cols-4 gap-3">
            <Field label="Mana cost">
              <input
                type="number"
                value={draft.manaCost}
                onChange={(e) => setDraft({ ...draft, manaCost: Number(e.target.value) || 0 })}
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-sm"
              />
            </Field>
            <Field label="Cooldown (ms)">
              <input
                type="number"
                value={draft.cooldownMs}
                onChange={(e) => setDraft({ ...draft, cooldownMs: Number(e.target.value) || 0 })}
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-sm"
              />
            </Field>
            <Field label="Level required">
              <input
                type="number"
                value={draft.levelRequired}
                onChange={(e) => setDraft({ ...draft, levelRequired: Number(e.target.value) || 1 })}
                className="ornate-input w-full px-2.5 py-1.5 font-mono text-sm"
              />
            </Field>
            <Field label="Target type">
              <select
                value={draft.targetType}
                onChange={(e) => setDraft({ ...draft, targetType: e.target.value })}
                className="ornate-input w-full px-2 py-1.5 text-sm"
              >
                <option value="self">Self</option>
                <option value="ally">Ally</option>
                <option value="enemy">Enemy</option>
                <option value="area">Area</option>
              </select>
            </Field>
          </div>

          <Field label="Effect">
            <div className="grid grid-cols-4 gap-2">
              <select
                value={draft.effect.type}
                onChange={(e) =>
                  setDraft({ ...draft, effect: { ...draft.effect, type: e.target.value } })
                }
                className="ornate-input col-span-2 w-full px-2 py-1.5 text-xs"
              >
                <option value="DIRECT_DAMAGE">Direct Damage</option>
                <option value="AREA_DAMAGE">Area Damage</option>
                <option value="DIRECT_HEAL">Heal</option>
                <option value="APPLY_STATUS">Apply Status</option>
                <option value="TAUNT">Taunt</option>
                <option value="SUMMON_PET">Summon Pet</option>
              </select>
              <EffectNumberInput label="min" value={draft.effect.minDamage ?? draft.effect.minHeal} onChange={(n) => {
                const next = { ...draft.effect };
                if (next.type === "DIRECT_HEAL") next.minHeal = n;
                else next.minDamage = n;
                setDraft({ ...draft, effect: next });
              }} />
              <EffectNumberInput label="max" value={draft.effect.maxDamage ?? draft.effect.maxHeal} onChange={(n) => {
                const next = { ...draft.effect };
                if (next.type === "DIRECT_HEAL") next.maxHeal = n;
                else next.maxDamage = n;
                setDraft({ ...draft, effect: next });
              }} />
            </div>
          </Field>

          <p className="text-2xs text-text-muted">
            Fine-tune effect parameters in the full Ability Designer after accepting — this form
            covers the core fields only.
          </p>
        </div>
      ) : null}
    </DialogShell>
  );
}

function EffectNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="font-display text-3xs uppercase tracking-wider text-text-muted">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && e.target.value !== "" ? n : undefined);
        }}
        className="ornate-input w-full px-1.5 py-1 font-mono text-xs"
      />
    </label>
  );
}

const COMMON_STATS = ["strength", "intelligence", "wisdom", "dexterity", "constitution", "charisma"];

function StatModEditor({
  statMods,
  onChange,
}: {
  statMods: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const keys = Array.from(new Set([...COMMON_STATS, ...Object.keys(statMods)]));
  const set = (stat: string, raw: string) => {
    const n = Number(raw);
    const next = { ...statMods };
    if (!Number.isFinite(n) || n === 0) {
      delete next[stat];
    } else {
      next[stat] = Math.max(-5, Math.min(5, Math.round(n)));
    }
    onChange(next);
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((stat) => (
        <label key={stat} className="flex items-center gap-2 text-2xs text-text-muted">
          <span className="w-16 truncate capitalize">{stat}</span>
          <input
            type="number"
            value={statMods[stat] ?? 0}
            onChange={(e) => set(stat, e.target.value)}
            className="ornate-input w-14 px-1.5 py-0.5 font-mono text-2xs"
            min={-5}
            max={5}
          />
        </label>
      ))}
    </div>
  );
}
