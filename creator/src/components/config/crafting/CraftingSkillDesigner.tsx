import type { CraftingSkillDefinition } from "@/types/config";
import { TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
import { TrashIcon } from "@/components/config/icons";

interface CraftingSkillDesignerProps {
  id: string;
  skill: CraftingSkillDefinition;
  onPatch: (p: Partial<CraftingSkillDefinition>) => void;
  onDelete: () => void;
}

export function CraftingSkillDesigner({
  id,
  skill,
  onPatch,
  onDelete,
}: CraftingSkillDesignerProps) {
  return (
    <SectionCard
      title="Crafting Skill Designer"
      actions={
        <button
          type="button"
          onClick={onDelete}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-2.5 py-1.5 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
        >
          <TrashIcon />
          Delete Skill
        </button>
      }
    >
      <div className="flex items-center gap-3 border-b border-[var(--chrome-stroke)] pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display text-xl font-semibold text-text-primary">
              {skill.displayName || id}
            </h4>
            <ActiveBadge />
          </div>
          <p className="mt-0.5 text-2xs text-text-muted/80">
            Configure how this crafting skill works and what it produces.
          </p>
        </div>
      </div>

      <SubSectionHeader label="Basic Information" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Display Name" hint="Name shown to players in the UI.">
          <TextInput
            value={skill.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Smithing"
            dense
          />
        </Field>
        <Field label="Type" hint="Category this skill belongs to.">
          <SelectInput
            value={skill.type}
            onCommit={(v) => onPatch({ type: v })}
            options={[
              { value: "gathering", label: "Gathering" },
              { value: "crafting", label: "Crafting" },
            ]}
            dense
          />
        </Field>
      </div>

      <SubSectionHeader label="Details" />

      <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3">
        <p className="font-display text-2xs font-semibold uppercase tracking-wider text-text-secondary">
          Gathering and crafting skill definitions.
        </p>
        <p className="mt-0.5 text-2xs leading-snug text-text-muted/80">
          {skill.type === "gathering"
            ? "Gathering skills harvest raw materials from the world."
            : "Crafting skills harvest raw materials and transform them into items."}
        </p>
      </div>

      <details className="mt-1 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-primary">
          <span className="inline-flex items-center gap-2">
            Additional Properties{" "}
            <span className="text-text-muted/60">(optional)</span>
          </span>
          <span aria-hidden="true" className="text-text-muted/60">
            ▾
          </span>
        </summary>
        <div className="border-t border-[var(--chrome-stroke)] px-3 py-2 text-2xs text-text-muted/70">
          No additional properties are configurable yet. This skill will use
          the global Skill Curve and Harvest Pacing settings above.
        </div>
      </details>
    </SectionCard>
  );
}

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-status-success/30 bg-status-success/10 px-1.5 py-0.5 font-display text-[0.55rem] font-semibold uppercase tracking-wider text-status-success">
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-status-success"
      />
      Active
    </span>
  );
}

function SubSectionHeader({ label }: { label: string }) {
  return (
    <p className="mt-1 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
      {label}
    </p>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
    </div>
  );
}
