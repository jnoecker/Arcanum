import type {
  AchievementCategoryDefinition,
  AchievementCriterionTypeDefinition,
} from "@/types/config";
import { TextInput, cx } from "@/components/ui/FormWidgets";

export function defaultAchievementCategoryDefinition(
  raw: string,
): AchievementCategoryDefinition {
  return { displayName: raw };
}

export function defaultAchievementCriterionTypeDefinition(
  raw: string,
): AchievementCriterionTypeDefinition {
  return { displayName: raw };
}

// ─── Categories ────────────────────────────────────────────────

export function CategoryDetail({
  category,
  patch,
}: {
  category: AchievementCategoryDefinition;
  patch: (p: Partial<AchievementCategoryDefinition>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Display name" hint="Shown in the Builder filter chips and in achievement listings.">
        <TextInput
          value={category.displayName}
          onCommit={(v) => patch({ displayName: v })}
          placeholder="Combat"
          dense
        />
      </Field>
    </div>
  );
}

// ─── Criterion types ───────────────────────────────────────────

interface ProgressMode {
  id: "none" | "counter" | "percentage" | "collection" | "custom";
  label: string;
  description: string;
  template: string | null;
  example: string;
}

const PROGRESS_MODES: ProgressMode[] = [
  {
    id: "none",
    label: "None",
    description: "Boolean — done or not done. No progress text shown.",
    template: null,
    example: "—",
  },
  {
    id: "counter",
    label: "Counter",
    description: "Show progress as a fraction.",
    template: "{current}/{required}",
    example: "5/10",
  },
  {
    id: "percentage",
    label: "Percentage",
    description: "Show progress as a percent.",
    template: "{percent}%",
    example: "47%",
  },
  {
    id: "collection",
    label: "Collection",
    description: "Show progress with a separator word.",
    template: "{current} of {required}",
    example: "3 of 10",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Write your own template using the tokens below.",
    template: "",
    example: "",
  },
];

function detectMode(template: string | undefined): ProgressMode["id"] {
  if (!template) return "none";
  const match = PROGRESS_MODES.find(
    (m) => m.template !== null && m.template !== "" && m.template === template,
  );
  return match?.id ?? "custom";
}

const PREVIEW_TOKENS: Record<string, string> = {
  "{current}": "5",
  "{required}": "10",
  "{percent}": "47",
};

function renderPreview(template: string): string {
  if (!template) return "—";
  return template.replace(/\{(current|required|percent)\}/g, (m) => PREVIEW_TOKENS[m] ?? m);
}

export function CriterionTypeDetail({
  criterion,
  patch,
}: {
  criterion: AchievementCriterionTypeDefinition;
  patch: (p: Partial<AchievementCriterionTypeDefinition>) => void;
}) {
  const mode = detectMode(criterion.progressFormat);
  const template = criterion.progressFormat ?? "";

  const selectMode = (next: ProgressMode) => {
    if (next.template === null) {
      patch({ progressFormat: undefined });
    } else if (next.id === "custom") {
      // Preserve any existing custom template; otherwise seed with a counter
      // template the user can edit instead of an empty string.
      if (!template) patch({ progressFormat: "{current}/{required}" });
    } else {
      patch({ progressFormat: next.template });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Display name" hint="Shown to authors when they pick this type for an achievement criterion.">
        <TextInput
          value={criterion.displayName}
          onCommit={(v) => patch({ displayName: v })}
          placeholder="Counter"
          dense
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div>
          <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
            Progress display
          </span>
          <p className="mt-0.5 text-2xs leading-snug text-text-muted/70">
            How players see their progress toward an achievement that uses this
            criterion type.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROGRESS_MODES.map((m) => {
            const active = mode === m.id;
            const preview =
              m.id === "custom"
                ? template
                  ? renderPreview(template)
                  : "—"
                : m.example;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m)}
                aria-pressed={active}
                className={cx(
                  "focus-ring flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition",
                  active
                    ? "selected-pill"
                    : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cx(
                      "font-display text-2xs font-semibold uppercase tracking-wider",
                      active ? "text-accent" : "text-text-primary",
                    )}
                  >
                    {m.label}
                  </span>
                  <span className="font-mono text-2xs text-text-muted/80">
                    {preview}
                  </span>
                </div>
                <span className="text-2xs leading-snug text-text-muted/80">
                  {m.description}
                </span>
              </button>
            );
          })}
        </div>

        {mode === "custom" && (
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3">
            <Field label="Custom template">
              <TextInput
                value={template}
                onCommit={(v) => patch({ progressFormat: v || undefined })}
                placeholder="{current}/{required}"
                dense
              />
            </Field>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--chrome-stroke)] bg-bg-primary/40 px-3 py-2">
              <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
                Preview
              </span>
              <span className="font-mono text-xs text-accent">
                {renderPreview(template)}
              </span>
            </div>
            <p className="text-2xs leading-snug text-text-muted/80">
              Tokens:{" "}
              <code className="font-mono text-text-muted">{"{current}"}</code>,{" "}
              <code className="font-mono text-text-muted">{"{required}"}</code>,{" "}
              <code className="font-mono text-text-muted">{"{percent}"}</code>.
            </p>
          </div>
        )}
      </div>
    </div>
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

export function summarizeCriterionType(
  criterion: AchievementCriterionTypeDefinition,
): string {
  const mode = detectMode(criterion.progressFormat);
  const def = PROGRESS_MODES.find((m) => m.id === mode);
  if (!def) return "";
  if (mode === "custom") return `Custom · ${renderPreview(criterion.progressFormat ?? "")}`;
  if (mode === "none") return "No progress display";
  return `${def.label} · ${def.example}`;
}
