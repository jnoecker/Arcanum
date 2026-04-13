import { useCallback, useMemo, useState } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { CurrencyDefinition } from "@/types/config";
import {
  TextInput,
  CommitTextarea,
  CompactField,
  FieldGrid,
  IconButton,
  EmptyState,
} from "@/components/ui/FormWidgets";
import { MISC_COIN } from "@/assets/ui";

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

function defaultCurrency(raw: string): CurrencyDefinition {
  const label = raw.trim();
  return {
    displayName: label
      ? label.charAt(0).toUpperCase() + label.slice(1)
      : "New Currency",
  };
}

// Sentinel returned when a currency has no emoji embedded in its display name.
const DEFAULT_GLYPH = "";

function extractGlyph(displayName: string): { glyph: string; rest: string } {
  const trimmed = displayName.trim();
  if (!trimmed) return { glyph: DEFAULT_GLYPH, rest: "" };
  // Pull off a leading emoji (unicode Extended_Pictographic) if present.
  const match = trimmed.match(/^(\p{Extended_Pictographic}(?:\p{Extended_Pictographic}|\uFE0F|\u200D)*)\s*(.*)$/u);
  if (match && match[1]) {
    return { glyph: match[1], rest: match[2] ?? "" };
  }
  return { glyph: DEFAULT_GLYPH, rest: trimmed };
}

// ─── Panel ──────────────────────────────────────────────────────────

export function CurrenciesPanel({ config, onChange }: ConfigPanelProps) {
  const currencies = { definitions: {}, ...config.currencies };
  const defs = currencies.definitions ?? {};
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);

  const entries = useMemo(() => Object.entries(defs), [defs]);

  const patchDef = useCallback(
    (key: string, updates: Partial<CurrencyDefinition>) => {
      const current = defs[key];
      if (!current) return;
      onChange({
        currencies: {
          ...currencies,
          definitions: { ...defs, [key]: { ...current, ...updates } },
        },
      } as Partial<AppConfig>);
    },
    [currencies, defs, onChange],
  );

  const deleteDef = useCallback(
    (key: string) => {
      const next = { ...defs };
      delete next[key];
      onChange({
        currencies: { ...currencies, definitions: next },
      } as Partial<AppConfig>);
      if (renaming === key) setRenaming(null);
    },
    [currencies, defs, onChange, renaming],
  );

  const addCurrency = useCallback(() => {
    const id = normalizeId(newName);
    if (!id || id in defs) return;
    onChange({
      currencies: {
        ...currencies,
        definitions: { ...defs, [id]: defaultCurrency(newName) },
      },
    } as Partial<AppConfig>);
    setNewName("");
  }, [currencies, defs, newName, onChange]);

  const renameDef = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || newId === oldId || defs[newId]) {
        setRenaming(null);
        return;
      }
      // Preserve insertion order by rebuilding the object key-for-key.
      const next: Record<string, CurrencyDefinition> = {};
      for (const [k, v] of Object.entries(defs)) {
        next[k === oldId ? newId : k] = v;
      }
      onChange({
        currencies: { ...currencies, definitions: next },
      } as Partial<AppConfig>);
      setRenaming(null);
    },
    [currencies, defs, onChange],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="panel-surface relative overflow-hidden rounded-3xl p-6 shadow-section">
        <div className="relative z-10 flex flex-col gap-5">
          <div className="max-w-2xl">
            <p className="border-l-2 border-accent/30 pl-2 text-2xs uppercase tracking-wide-ui text-text-muted">
              Treasury &amp; rewards
            </p>
            <h2 className="mt-2 font-display font-semibold text-xl text-text-primary">
              Secondary Currencies
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Non-gold currencies players earn and spend — faction reputation,
              honor, arena tokens, raid marks, moonfavor. They appear alongside
              gold in the player's pouch and are spendable by shops, quests,
              and rewards. One record per type.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-t border-border-muted/50 pt-4">
            <div className="flex items-center gap-1.5">
              <input
                className="w-48 rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
                placeholder="new_currency_id"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCurrency();
                }}
                aria-label="New currency id"
              />
              <button
                type="button"
                onClick={addCurrency}
                disabled={!newName.trim() || newName.trim() in defs}
                className="focus-ring rounded border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add
              </button>
            </div>

            <div className="ml-auto text-right">
              <p className="font-display text-2xl font-semibold leading-none text-text-primary">
                {entries.length}
              </p>
              <p className="mt-1 text-2xs uppercase tracking-wider text-text-muted">
                {entries.length === 1 ? "currency" : "currencies"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grid ─────────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <EmptyState
          title="No secondary currencies"
          description="Add an id above to start tracking reputation, tokens, or favor alongside gold."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {entries.map(([key, def]) => (
            <CurrencyCard
              key={key}
              id={key}
              def={def}
              renaming={renaming === key}
              onStartRename={() => setRenaming(key)}
              onCancelRename={() => setRenaming(null)}
              onCommitRename={(next) => renameDef(key, next)}
              onPatch={(p) => patchDef(key, p)}
              onDelete={() => deleteDef(key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────

interface CurrencyCardProps {
  id: string;
  def: CurrencyDefinition;
  renaming: boolean;
  onStartRename: () => void;
  onCancelRename: () => void;
  onCommitRename: (next: string) => void;
  onPatch: (p: Partial<CurrencyDefinition>) => void;
  onDelete: () => void;
}

function CurrencyCard({
  id,
  def,
  renaming,
  onStartRename,
  onCancelRename,
  onCommitRename,
  onPatch,
  onDelete,
}: CurrencyCardProps) {
  const [renameDraft, setRenameDraft] = useState(id);
  const { glyph, rest } = extractGlyph(def.displayName || id);
  const displayName = rest || id;
  const abbrev = def.abbreviation?.trim();

  return (
    <div className="group/card relative flex flex-col gap-3 rounded-2xl border border-border-default bg-bg-primary/40 p-4 transition-colors hover:border-accent/40 hover:bg-bg-primary/60">
      {/* Header — id + hover rail */}
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <input
              autoFocus
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommitRename(renameDraft);
                if (e.key === "Escape") {
                  setRenameDraft(id);
                  onCancelRename();
                }
              }}
              onBlur={() => {
                if (renameDraft === id) onCancelRename();
              }}
              className="min-w-0 flex-1 rounded border border-accent/50 bg-bg-primary px-1.5 py-0.5 font-mono text-xs text-text-primary outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
              aria-label="Rename currency id"
            />
            <button
              type="button"
              onClick={() => onCommitRename(renameDraft)}
              className="focus-ring rounded border border-accent/40 px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent/10"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setRenameDraft(id);
              onStartRename();
            }}
            className="focus-ring min-w-0 flex-1 truncate rounded text-left font-mono text-[11px] text-text-muted hover:text-accent"
            title="Click to rename the currency id"
          >
            {id}
          </button>
        )}
        {!renaming && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
            <IconButton
              onClick={() => {
                setRenameDraft(id);
                onStartRename();
              }}
              title="Rename id"
              size="sm"
            >
              &#x270E;
            </IconButton>
            <IconButton
              onClick={onDelete}
              title="Delete currency"
              danger
              size="sm"
            >
              &#x2715;
            </IconButton>
          </div>
        )}
      </div>

      {/* Pouch preview */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-border-muted/60 bg-bg-abyss/40 px-3 py-2.5">
        <span className="text-[9px] uppercase tracking-widest text-text-muted/70">
          Pouch preview
        </span>
        <div className="flex items-center gap-2">
          {glyph ? (
            <span className="text-xl leading-none" aria-hidden="true">
              {glyph}
            </span>
          ) : (
            <img src={MISC_COIN} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 object-contain" />
          )}
          <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="truncate font-display text-sm font-semibold text-text-primary">
              {displayName}
            </span>
            {abbrev && (
              <span className="shrink-0 rounded border border-border-default px-1 font-mono text-[9px] uppercase text-text-muted">
                {abbrev}
              </span>
            )}
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-accent">
            1,500
          </span>
        </div>
        {def.description?.trim() && (
          <p className="line-clamp-2 pl-7 text-2xs italic text-text-muted/80">
            {def.description}
          </p>
        )}
      </div>

      {/* Fields */}
      <FieldGrid cols={2}>
        <CompactField
          label="Display Name"
          hint="Prefix with an emoji to give it a pouch glyph."
          span
        >
          <TextInput
            value={def.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Honor Points"
            dense
          />
        </CompactField>
        <CompactField label="Abbreviation" hint="2–4 letters, optional.">
          <TextInput
            value={def.abbreviation ?? ""}
            onCommit={(v) => onPatch({ abbreviation: v || undefined })}
            placeholder="HP"
            dense
          />
        </CompactField>
      </FieldGrid>
      <CommitTextarea
        label="Description"
        value={def.description ?? ""}
        onCommit={(v) => onPatch({ description: v || undefined })}
        placeholder="Earned through valorous combat in the arena."
        rows={2}
      />
    </div>
  );
}
