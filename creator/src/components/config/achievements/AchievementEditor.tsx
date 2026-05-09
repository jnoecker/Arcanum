import type {
  AppConfig,
  AchievementDefFile,
  AchievementCriterionFile,
  AchievementRewardsFile,
} from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { useArrayField } from "@/lib/useArrayField";
import { useZoneStore } from "@/stores/zoneStore";
import { SectionCard } from "../panels/factions/SectionCard";
import {
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "./icons";
import { useCallback, useMemo, useState } from "react";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/**
 * Editor surfaces sit visually beneath the Preview unlock card. Use a lighter
 * gradient + thin border + no elevation so the Preview's shadow-glow-warm-strong
 * and animate-warm-breathe halo wins the eye in the right pane.
 */
const EDITOR_CARD_CLASS =
  "!bg-gradient-panel-light !shadow-none !border-[var(--chrome-stroke)]/60";

const DEFAULT_CRITERION: AchievementCriterionFile = {
  type: "kill",
  targetId: "",
  count: 1,
  description: "",
};

const DESCRIPTION_LIMIT = 200;
const CRITERION_DESC_LIMIT = 120;

interface AchievementEditorProps {
  id: string;
  def: AchievementDefFile;
  config: AppConfig;
  onPatch: (p: Partial<AchievementDefFile>) => void;
  onRename: (newId: string) => void;
}

export function AchievementEditor({
  id,
  def,
  config,
  onPatch,
  onRename,
}: AchievementEditorProps) {
  const categoryOptions = Object.entries(config.achievementCategories).map(
    ([cid, cat]) => ({ value: cid, label: cat.displayName || cid }),
  );

  const criterionTypeOptions = Object.entries(config.achievementCriterionTypes).map(
    ([tid, ct]) => ({ value: tid, label: ct.displayName || tid }),
  );

  const {
    items: criteria,
    add: handleAddCriterion,
    update: handleUpdateCriterion,
    remove: handleRemoveCriterion,
  } = useArrayField<AchievementCriterionFile>(
    def.criteria,
    (next) => onPatch({ criteria: next ?? [] }),
    DEFAULT_CRITERION,
  );

  const moveCriterion = (from: number, to: number) => {
    if (to < 0 || to >= criteria.length) return;
    const next = [...criteria];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onPatch({ criteria: next });
  };

  const rewards = def.rewards ?? {};
  const handleRewardChange = useCallback(
    (field: keyof AchievementRewardsFile, value: string | number | undefined) => {
      const next: AchievementRewardsFile = { ...rewards, [field]: value };
      const hasReward =
        (next.xp ?? 0) > 0 || (next.gold ?? 0) > 0 || (next.title ?? "").length > 0;
      onPatch({ rewards: hasReward ? next : undefined });
    },
    [rewards, onPatch],
  );

  return (
    <div className="flex flex-col gap-3">
      <BasicsCard
        id={id}
        def={def}
        categoryOptions={categoryOptions}
        onPatch={onPatch}
        onRename={onRename}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <CriteriaCard
          criteria={criteria}
          criterionTypeOptions={criterionTypeOptions}
          onAdd={() => handleAddCriterion()}
          onUpdate={handleUpdateCriterion}
          onRemove={handleRemoveCriterion}
          onMove={moveCriterion}
        />
        <RewardsCard rewards={rewards} onChange={handleRewardChange} />
      </div>
    </div>
  );
}

// ─── Basics ────────────────────────────────────────────────────────

interface BasicsCardProps {
  id: string;
  def: AchievementDefFile;
  categoryOptions: { value: string; label: string }[];
  onPatch: (p: Partial<AchievementDefFile>) => void;
  onRename: (newId: string) => void;
}

function BasicsCard({ id, def, categoryOptions, onPatch, onRename }: BasicsCardProps) {
  const desc = def.description ?? "";
  const remaining = DESCRIPTION_LIMIT - desc.length;
  const overLimit = remaining < 0;

  return (
    <SectionCard title="Basics" className={EDITOR_CARD_CLASS}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <FieldLabel label="Display Name" required>
            <TextInput
              value={def.displayName}
              onCommit={(v) => onPatch({ displayName: v })}
              placeholder="First Blood"
              dense
            />
          </FieldLabel>
          <FieldLabel label="Slug" required>
            <SlugRenamer id={id} onRename={onRename} />
          </FieldLabel>
          <FieldLabel label="Category" required>
            <SelectInput
              value={def.category}
              options={categoryOptions}
              onCommit={(v) => onPatch({ category: v })}
              placeholder="— select category —"
              dense
            />
          </FieldLabel>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
              Description
            </span>
            <span
              className={cx(
                "font-mono text-[0.6rem]",
                overLimit ? "text-status-error" : "text-text-muted/60",
              )}
            >
              {desc.length} / {DESCRIPTION_LIMIT}
            </span>
          </div>
          <CommitTextarea
            label=""
            value={desc}
            onCommit={(v) => onPatch({ description: v || undefined })}
            placeholder="Defeat your first enemy in combat."
            rows={5}
          />
          <CompactHiddenToggle
            checked={def.hidden ?? false}
            onChange={(v) => onPatch({ hidden: v || undefined })}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function SlugRenamer({ id, onRename }: { id: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(id);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== id) setDraft(id);

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    else setDraft(id);
  };

  return (
    <input
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(id);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="first_blood"
    />
  );
}

function CompactHiddenToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="focus-within:ring-1 focus-within:ring-accent inline-flex cursor-pointer select-none items-center gap-2 self-start rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-1 transition hover:border-accent/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 cursor-pointer accent-accent"
      />
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        Hidden until unlocked
      </span>
    </label>
  );
}

// ─── Criteria ──────────────────────────────────────────────────────

interface CriteriaCardProps {
  criteria: AchievementCriterionFile[];
  criterionTypeOptions: { value: string; label: string }[];
  onAdd: () => void;
  onUpdate: (
    index: number,
    field: keyof AchievementCriterionFile,
    value: AchievementCriterionFile[keyof AchievementCriterionFile],
  ) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}

function CriteriaCard({
  criteria,
  criterionTypeOptions,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: CriteriaCardProps) {
  return (
    <SectionCard
      title="Criteria"
      className={EDITOR_CARD_CLASS}
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent transition hover:bg-accent/20"
        >
          <PlusIcon />
          Add Criterion
        </button>
      }
    >
      {criteria.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-6 text-center">
          <p className="text-2xs italic text-text-muted/80">
            No criteria yet — add at least one to make this achievement earnable.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {criteria.map((crit, i) => (
            <CriterionRow
              key={i}
              index={i}
              criterion={crit}
              total={criteria.length}
              criterionTypeOptions={criterionTypeOptions}
              onUpdate={(field, value) => onUpdate(i, field, value)}
              onRemove={() => onRemove(i)}
              onMoveUp={() => onMove(i, i - 1)}
              onMoveDown={() => onMove(i, i + 1)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

interface CriterionRowProps {
  index: number;
  total: number;
  criterion: AchievementCriterionFile;
  criterionTypeOptions: { value: string; label: string }[];
  onUpdate: (
    field: keyof AchievementCriterionFile,
    value: AchievementCriterionFile[keyof AchievementCriterionFile],
  ) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function CriterionRow({
  index,
  total,
  criterion,
  criterionTypeOptions,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: CriterionRowProps) {
  const desc = criterion.description ?? "";
  const overLimit = desc.length > CRITERION_DESC_LIMIT;
  const mobOptions = useMobOptions();

  return (
    <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-[0.6rem] font-semibold text-accent"
        >
          {index + 1}
        </span>
        <p className="min-w-0 flex-1 truncate font-display text-xs font-semibold text-text-primary">
          {criterion.description?.trim() || `Defeat a ${criterion.type}`}
        </p>
        <div className="flex items-center opacity-60 transition group-hover:opacity-100">
          <IconAction label="Move up" onClick={onMoveUp} disabled={index === 0}>
            <ArrowUpIcon />
          </IconAction>
          <IconAction
            label="Move down"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ArrowDownIcon />
          </IconAction>
          <IconAction label="Remove criterion" onClick={onRemove} danger>
            <TrashIcon />
          </IconAction>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <FieldLabel label="Type" required>
          <SelectInput
            value={criterion.type}
            options={criterionTypeOptions}
            onCommit={(v) => onUpdate("type", v)}
            dense
          />
        </FieldLabel>
        <FieldLabel label="Count" required>
          <NumberInput
            value={criterion.count ?? 1}
            onCommit={(v) => onUpdate("count", v ?? 1)}
            min={1}
            dense
          />
        </FieldLabel>
        <div className="col-span-2">
          <FieldLabel label="Target">
            <SelectInput
              value={criterion.targetId ?? ""}
              options={mobOptions}
              onCommit={(v) => onUpdate("targetId", v || undefined)}
              allowEmpty
              placeholder="— any —"
              dense
            />
          </FieldLabel>
        </div>
        <div className="col-span-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
              Description
            </span>
            <span
              className={cx(
                "font-mono text-[0.6rem]",
                overLimit ? "text-status-error" : "text-text-muted/60",
              )}
            >
              {desc.length} / {CRITERION_DESC_LIMIT}
            </span>
          </div>
          <CommitTextarea
            label=""
            value={desc}
            onCommit={(v) => onUpdate("description", v || undefined)}
            placeholder="Optional flavor text…"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

function useMobOptions(): { value: string; label: string }[] {
  const zones = useZoneStore((s) => s.zones);
  return useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const zoneIds = Array.from(zones.keys()).sort();
    for (const zoneId of zoneIds) {
      const zone = zones.get(zoneId);
      const mobs = zone?.data.mobs ?? {};
      const mobIds = Object.keys(mobs).sort();
      for (const mobId of mobIds) {
        const mob = mobs[mobId]!;
        const label = `${zoneId} · ${mob.name || mobId}`;
        out.push({ value: `${zoneId}:${mobId}`, label });
      }
    }
    return out;
  }, [zones]);
}

// ─── Rewards ───────────────────────────────────────────────────────

interface RewardsCardProps {
  rewards: AchievementRewardsFile;
  onChange: (field: keyof AchievementRewardsFile, value: string | number | undefined) => void;
}

function RewardsCard({ rewards, onChange }: RewardsCardProps) {
  const xp = rewards.xp ?? 0;
  const gold = rewards.gold ?? 0;
  const title = rewards.title ?? "";

  return (
    <SectionCard title="Rewards" className={EDITOR_CARD_CLASS}>
      <div className="grid grid-cols-2 gap-2">
        <FieldLabel label="XP">
          <NumberInput
            value={xp}
            onCommit={(v) => onChange("xp", v)}
            min={0}
            dense
          />
        </FieldLabel>
        <FieldLabel label="Gold">
          <NumberInput
            value={gold}
            onCommit={(v) => onChange("gold", v)}
            min={0}
            dense
          />
        </FieldLabel>
      </div>
      <div className="mt-2">
        <FieldLabel label="Title">
          <TextInput
            value={title}
            onCommit={(v) => onChange("title", v || undefined)}
            placeholder="Optional"
            dense
          />
        </FieldLabel>
      </div>
    </SectionCard>
  );
}

// ─── Shared primitives ─────────────────────────────────────────────

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cx(
        "focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30",
        danger
          ? "text-text-muted/70 hover:bg-status-error/15 hover:text-status-error"
          : "text-text-muted/70 hover:bg-[var(--chrome-fill)] hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

