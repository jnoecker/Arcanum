import { useEffect, useRef, useState } from "react";
import type { AppConfig } from "@/types/config";
import { NumberInput, SelectInput } from "@/components/ui/FormWidgets";

interface CreationHeroProps {
  config: AppConfig;
  onPatch: (p: Partial<AppConfig["characterCreation"]>) => void;
}

interface Option {
  value: string;
  label: string;
}

interface LedgerNumberProps {
  label: string;
  hint: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
}

/**
 * Inline labelled numeric value: Cinzel uppercase label sitting beside a
 * mono numeral. Click the numeral to open a small popover with NumberInput.
 */
function LedgerNumber({ label, hint, value, onCommit, min }: LedgerNumberProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex items-baseline gap-2">
      <span className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={hint}
        aria-label={`${label}: ${value} (click to edit)`}
        className="focus-ring rounded font-mono text-base font-semibold leading-none text-text-primary transition hover:text-accent"
      >
        {value}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-[var(--chrome-stroke-strong)] bg-[var(--bg-panel)] p-2 shadow-glow-warm">
          <p className="mb-1 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            {label}
          </p>
          <NumberInput
            value={value}
            onCommit={(v) => {
              if (v != null) onCommit(v);
              setOpen(false);
            }}
            min={min}
            dense
          />
          <p className="mt-1 text-2xs leading-snug text-text-muted/70">{hint}</p>
        </div>
      )}
    </div>
  );
}

interface LedgerSelectProps {
  label: string;
  hint: string;
  value: string;
  options: Option[];
  onCommit: (v: string) => void;
  placeholder?: string;
}

/**
 * Inline labelled select: Cinzel uppercase label beside the chosen option's
 * label. Click to open a small popover with the SelectInput primitive.
 */
function LedgerSelect({
  label,
  hint,
  value,
  options,
  onCommit,
  placeholder,
}: LedgerSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? "None";

  return (
    <div ref={wrapRef} className="relative flex items-baseline gap-2">
      <span className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={hint}
        aria-label={`${label}: ${display} (click to edit)`}
        className="focus-ring rounded font-display text-sm font-semibold leading-none text-text-primary transition hover:text-accent"
      >
        {display}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-[var(--chrome-stroke-strong)] bg-[var(--bg-panel)] p-2 shadow-glow-warm">
          <p className="mb-1 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            {label}
          </p>
          <SelectInput
            value={value}
            options={options}
            onCommit={(v) => {
              onCommit(v);
              setOpen(false);
            }}
            allowEmpty
            placeholder={placeholder ?? "(none)"}
            dense
          />
          <p className="mt-1 text-2xs leading-snug text-text-muted/70">{hint}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Ceremonial header for the Character Creation panel + a single horizontal
 * ledger strip of the four "starting state" defaults. No card chrome —
 * starting state demoted so the Gender Designer below carries the panel.
 */
export function CreationHero({ config, onPatch }: CreationHeroProps) {
  const cc = config.characterCreation;

  const raceOptions: Option[] = Object.entries(config.races).map(([id, r]) => ({
    value: id,
    label: r.displayName || id,
  }));
  const classOptions: Option[] = Object.entries(config.classes).map(([id, c]) => ({
    value: id,
    label: c.displayName || id,
  }));
  const genderOptions: Option[] = Object.entries(config.genders).map(([id, g]) => ({
    value: id,
    label: g.displayName || id,
  }));

  return (
    <section className="flex flex-col gap-5 px-1 pt-1">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
          Character Foundations
        </p>
        <span aria-hidden="true" className="text-text-muted/40">·</span>
        <p className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
          {Object.keys(config.genders).length}{" "}
          {Object.keys(config.genders).length === 1 ? "gender" : "genders"}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          Character Creation
        </h2>
        <p className="max-w-2xl text-xs leading-relaxed text-text-secondary">
          The first choices a new soul makes. Set the starting purse and the
          defaults that greet them at the threshold, then shape the genders
          they may step into below.
        </p>
      </div>

      <div className="relative flourish-top-thread border-t border-b border-[var(--chrome-stroke)] py-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <span className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted/80">
            Starting State
          </span>
          <LedgerNumber
            label="Gold"
            hint="Coins pressed into a new soul's palm. 0 — they earn every copper. 50–100 — a plain weapon. 500+ — already well-shod."
            value={cc.startingGold}
            onCommit={(v) => onPatch({ startingGold: v })}
            min={0}
          />
          <span aria-hidden="true" className="text-text-muted/40">·</span>
          <LedgerSelect
            label="Default Race"
            hint="Pre-selected race at character creation. Players may still change it."
            value={cc.defaultRace ?? ""}
            options={raceOptions}
            onCommit={(v) => onPatch({ defaultRace: v || undefined })}
            placeholder="None"
          />
          <span aria-hidden="true" className="text-text-muted/40">·</span>
          <LedgerSelect
            label="Default Class"
            hint="Pre-selected class at character creation. Players may still change it."
            value={cc.defaultClass ?? ""}
            options={classOptions}
            onCommit={(v) => onPatch({ defaultClass: v || undefined })}
            placeholder="None"
          />
          <span aria-hidden="true" className="text-text-muted/40">·</span>
          <LedgerSelect
            label="Default Gender"
            hint="Pre-selected gender at character creation. Players may still change it."
            value={cc.defaultGender ?? ""}
            options={genderOptions}
            onCommit={(v) => onPatch({ defaultGender: v || undefined })}
            placeholder="None"
          />
        </div>
      </div>
    </section>
  );
}
