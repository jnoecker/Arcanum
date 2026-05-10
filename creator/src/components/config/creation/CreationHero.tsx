import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

// ─── Floating popover anchored to a trigger ───────────────────────

const POPOVER_GAP = 6;
const POPOVER_MARGIN = 8;

function FloatingPopover({
  triggerRef,
  width,
  onClose,
  children,
}: {
  triggerRef: React.RefObject<HTMLElement | null>;
  width: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Outside click + Escape close.
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, triggerRef]);

  // Close on scroll/resize so the popover never drifts away from its trigger.
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [onClose]);

  // Position relative to the viewport, flipping above when there isn't room
  // below the trigger. Re-measures after the popover paints so we account
  // for its actual height rather than guessing.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const pop = popoverRef.current;
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const popHeight = pop?.offsetHeight ?? 180;
    const wantsBelow = triggerRect.bottom + POPOVER_GAP + popHeight + POPOVER_MARGIN <= vh;
    const top = wantsBelow
      ? triggerRect.bottom + POPOVER_GAP
      : Math.max(POPOVER_MARGIN, triggerRect.top - POPOVER_GAP - popHeight);
    const left = Math.max(
      POPOVER_MARGIN,
      Math.min(vw - width - POPOVER_MARGIN, triggerRect.left),
    );
    setCoords({ top, left });
  }, [triggerRef, width]);

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      style={{
        position: "fixed",
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        width,
        visibility: coords ? "visible" : "hidden",
      }}
      className="z-[100] rounded-lg border border-[var(--chrome-stroke-strong)] bg-[var(--bg-panel)] p-2 shadow-glow-warm"
    >
      {children}
    </div>,
    document.body,
  );
}

// ─── Ledger primitives ─────────────────────────────────────────────

interface LedgerNumberProps {
  label: string;
  hint: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
}

function LedgerNumber({ label, hint, value, onCommit, min }: LedgerNumberProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={hint}
        aria-label={`${label}: ${value} (click to edit)`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="focus-ring rounded font-mono text-base font-semibold leading-none text-text-primary transition hover:text-accent"
      >
        {value}
      </button>
      {open && (
        <FloatingPopover triggerRef={triggerRef} width={192} onClose={() => setOpen(false)}>
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
        </FloatingPopover>
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

function LedgerSelect({
  label,
  hint,
  value,
  options,
  onCommit,
  placeholder,
}: LedgerSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? "None";

  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={hint}
        aria-label={`${label}: ${display} (click to edit)`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="focus-ring rounded font-display text-sm font-semibold leading-none text-text-primary transition hover:text-accent"
      >
        {display}
      </button>
      {open && (
        <FloatingPopover triggerRef={triggerRef} width={224} onClose={() => setOpen(false)}>
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
        </FloatingPopover>
      )}
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────

/**
 * Slim Starting State strip. The kicker, title, and lede that used to live
 * above were removed in favor of going straight to the data.
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
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3 px-1 pt-1">
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
  );
}
