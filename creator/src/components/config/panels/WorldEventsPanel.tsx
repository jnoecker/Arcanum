import { useEffect, useMemo, useState } from "react";
import type { ConfigPanelProps } from "./types";
import type { WorldEventDefinitionConfig } from "@/types/config";
import { TextInput, CommitTextarea } from "@/components/ui/FormWidgets";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function defaultEvent(raw: string): WorldEventDefinitionConfig {
  const cleaned = raw.trim() || "New Event";
  return { displayName: cleaned };
}

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "new_event";
  if (!existing[base]) return base;
  let i = 2;
  while (existing[`${base}_${i}`]) i += 1;
  return `${base}_${i}`;
}

function eventStatus(evt: WorldEventDefinitionConfig): {
  label: string;
  tone: "active" | "scheduled";
} {
  if (evt.startDate && evt.endDate) {
    return { label: `${evt.startDate} → ${evt.endDate}`, tone: "scheduled" };
  }
  if (evt.startDate) return { label: `from ${evt.startDate}`, tone: "scheduled" };
  if (evt.endDate) return { label: `until ${evt.endDate}`, tone: "scheduled" };
  return { label: "always active", tone: "active" };
}

export function WorldEventsPanel({ config, onChange }: ConfigPanelProps) {
  const defs = config.worldEvents.definitions;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && defs[selectedId]) return;
    setSelectedId(Object.keys(defs)[0] ?? null);
  }, [defs, selectedId]);

  const patchDefs = (next: Record<string, WorldEventDefinitionConfig>) =>
    onChange({ worldEvents: { ...config.worldEvents, definitions: next } });

  const patchEvent = (id: string, p: Partial<WorldEventDefinitionConfig>) => {
    const cur = defs[id];
    if (!cur) return;
    patchDefs({ ...defs, [id]: { ...cur, ...p } });
  };

  const addEvent = () => {
    const id = nextDefaultId(defs);
    patchDefs({ ...defs, [id]: defaultEvent("New Event") });
    setSelectedId(id);
  };

  const deleteEvent = (id: string) => {
    const next = { ...defs };
    delete next[id];
    patchDefs(next);
    if (selectedId === id) setSelectedId(null);
  };

  const renameEvent = (oldId: string, rawNewId: string) => {
    const newId = normalizeId(rawNewId);
    if (!newId || oldId === newId || defs[newId]) return;
    const next: Record<string, WorldEventDefinitionConfig> = {};
    for (const [k, v] of Object.entries(defs)) {
      next[k === oldId ? newId : k] = v;
    }
    patchDefs(next);
    if (selectedId === oldId) setSelectedId(newId);
  };

  const selected = useMemo(
    () => (selectedId ? defs[selectedId] ?? null : null),
    [defs, selectedId],
  );

  const eventCount = Object.keys(defs).length;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <EventsList
          defs={defs}
          count={eventCount}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
          onAdd={addEvent}
          onDelete={deleteEvent}
        />
      </div>

      <div className="xl:col-span-8">
        {selectedId && selected ? (
          <EventEditor
            id={selectedId}
            event={selected}
            onPatch={(p) => patchEvent(selectedId, p)}
            onRename={(v) => renameEvent(selectedId, v)}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="panel-surface flex h-full items-center justify-center rounded-2xl p-8 shadow-section">
            <div className="text-center">
              <p className="font-display text-xs uppercase tracking-wider text-text-muted">
                Nothing selected
              </p>
              <p className="mt-2 text-2xs leading-snug text-text-muted/70">
                Pick an event from the list, or add a new one to get started.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── List ──────────────────────────────────────────────────────────

function EventsList({
  defs,
  count,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  defs: Record<string, WorldEventDefinitionConfig>;
  count: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="panel-surface flex flex-col gap-3 rounded-2xl p-4 shadow-section">
      <header>
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Seasonal Events <span className="text-text-muted/60">({count})</span>
        </h3>
        <p className="mt-1 text-2xs leading-relaxed text-text-muted">
          Scheduled or permanent world events — festivals, invasions, blood
          moons, harvest seasons. Events expose flags that quests, mobs, and
          items can query. Leave the schedule empty for a flag that's always
          active.
        </p>
      </header>

      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-accent transition hover:bg-accent/20"
      >
        <PlusGlyph /> New Event Key
      </button>

      <ul className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1 pb-1">
        {Object.keys(defs).length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No events yet.
            </div>
          </li>
        ) : (
          Object.entries(defs).map(([id, evt]) => {
            const status = eventStatus(evt);
            const isSelected = selectedId === id;
            return (
              <li key={id}>
                <div
                  className={cx(
                    "group relative flex items-center gap-2 rounded-xl border px-3 py-2.5 transition",
                    isSelected
                      ? "selected-card"
                      : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    aria-pressed={isSelected}
                    className="focus-ring flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className="truncate font-display text-base font-semibold text-text-primary">
                      {evt.displayName || id}
                    </span>
                    <span className="mt-0.5 truncate font-mono text-[0.6rem] text-text-muted/70">
                      {id}
                    </span>
                  </button>

                  <span
                    className={cx(
                      "shrink-0 font-display text-[0.6rem] uppercase tracking-wider",
                      status.tone === "active"
                        ? "text-accent"
                        : "text-text-muted",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {status.label}
                      <StatusDot tone={status.tone} />
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onDelete(id)}
                    title={`Delete ${id}`}
                    aria-label={`Delete ${id}`}
                    className="focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--chrome-stroke)] bg-bg-primary/60 text-text-muted/70 opacity-60 transition hover:border-status-error/40 hover:bg-status-error/10 hover:text-status-error group-hover:opacity-100"
                  >
                    <XGlyph />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

// ─── Editor ────────────────────────────────────────────────────────

function EventEditor({
  id,
  event,
  onPatch,
  onRename,
  onClose,
}: {
  id: string;
  event: WorldEventDefinitionConfig;
  onPatch: (p: Partial<WorldEventDefinitionConfig>) => void;
  onRename: (newId: string) => void;
  onClose: () => void;
}) {
  const status = eventStatus(event);

  return (
    <section className="panel-surface flex flex-col gap-4 rounded-2xl p-4 shadow-section">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--chrome-stroke)] pb-3">
        <h2 className="truncate font-display text-2xl font-semibold text-text-primary">
          {event.displayName || id}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-display text-[0.6rem] uppercase tracking-wider",
              status.tone === "active"
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted",
            )}
          >
            {status.label}
            <StatusDot tone={status.tone} />
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close editor"
            aria-label="Close editor"
            className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary"
          >
            <XGlyph />
          </button>
        </div>
      </header>

      <Section title="Display Name">
        <TextInput
          value={event.displayName}
          onCommit={(v) => onPatch({ displayName: v })}
          placeholder="Spring Festival"
          dense
        />
        <Hint>Name shown to players in broadcast messages and event listings.</Hint>
      </Section>

      <Section title="Description">
        <TextInput
          value={event.description ?? ""}
          onCommit={(v) => onPatch({ description: v || undefined })}
          placeholder="A week of feasts and dancing…"
          dense
        />
        <Hint>Short flavor summary. Shown in help text and event info commands.</Hint>
      </Section>

      <Section title="Schedule">
        <Hint>
          ISO dates (yyyy-MM-dd). Leave both empty for a permanent event that's
          always active.
        </Hint>
        <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldLabel label="Start Date">
            <DateInput
              value={event.startDate ?? ""}
              onCommit={(v) => onPatch({ startDate: v || undefined })}
            />
            <Hint subtle>Day the event activates.</Hint>
          </FieldLabel>
          <FieldLabel label="End Date">
            <DateInput
              value={event.endDate ?? ""}
              onCommit={(v) => onPatch({ endDate: v || undefined })}
            />
            <Hint subtle>Day the event deactivates.</Hint>
          </FieldLabel>
        </div>
      </Section>

      <Section title="Flags">
        <Hint>
          Comma-separated tags that quests, mobs, items, and drop tables can
          check. Flags are the main way event state influences gameplay.
        </Hint>
        <div className="mt-1">
          <TextInput
            value={(event.flags ?? []).join(", ")}
            onCommit={(v) =>
              onPatch({
                flags: v
                  ? v.split(",").map((s) => s.trim()).filter(Boolean)
                  : undefined,
              })
            }
            placeholder="spring_festival, bonus_herbalism"
            dense
          />
          <Hint subtle>Example: spring_festival, bonus_herbalism, double_xp.</Hint>
        </div>
      </Section>

      <Section title="Broadcast Messages">
        <Hint>Shown to every online player when the event toggles on or off.</Hint>
        <div className="mt-1 flex flex-col gap-3">
          <FieldLabel label="Start Message">
            <CommitTextarea
              label=""
              value={event.startMessage ?? ""}
              onCommit={(v) => onPatch({ startMessage: v || undefined })}
              placeholder="The festival has begun!"
              rows={2}
            />
            <Hint subtle>Broadcast the moment the event activates.</Hint>
          </FieldLabel>
          <FieldLabel label="End Message">
            <CommitTextarea
              label=""
              value={event.endMessage ?? ""}
              onCommit={(v) => onPatch({ endMessage: v || undefined })}
              placeholder="The festival has ended."
              rows={2}
            />
            <Hint subtle>Broadcast when the event expires.</Hint>
          </FieldLabel>
        </div>
      </Section>

      <div className="flex items-center justify-center border-t border-[var(--chrome-stroke)] pt-3">
        <RenameButton id={id} onRename={onRename} />
      </div>
    </section>
  );
}

// ─── Rename ────────────────────────────────────────────────────────

function RenameButton({
  id,
  onRename,
}: {
  id: string;
  onRename: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(id);

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5">
        <input
          autoFocus
          className="ornate-input min-h-7 w-44 px-2 py-0.5 font-mono text-xs text-text-primary"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (draft.trim() && draft !== id) onRename(draft);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(id);
              setEditing(false);
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (draft.trim() && draft !== id) onRename(draft);
            setEditing(false);
          }}
          className="focus-ring rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 font-display text-2xs uppercase tracking-wider text-accent transition hover:bg-accent/20"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(id);
            setEditing(false);
          }}
          className="focus-ring rounded-md border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-0.5 font-display text-2xs uppercase tracking-wider text-text-muted transition hover:border-accent/30 hover:text-text-primary"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(id);
        setEditing(true);
      }}
      title={`Rename ${id}`}
      className="focus-ring inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-accent transition hover:bg-accent/20"
    >
      Rename ID…
    </button>
  );
}

// ─── Compact date input ────────────────────────────────────────────

function DateInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  return (
    <input
      type="date"
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      placeholder="yyyy-mm-dd"
    />
  );
}

// ─── Shared primitives ─────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-accent">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Hint({
  children,
  subtle,
}: {
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <p
      className={cx(
        "text-2xs leading-snug",
        subtle ? "text-text-muted/60" : "text-text-muted/80",
      )}
    >
      {children}
    </p>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function StatusDot({ tone }: { tone: "active" | "scheduled" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block h-1.5 w-1.5 rounded-full",
        tone === "active" ? "bg-accent" : "bg-text-muted/50",
      )}
    />
  );
}

function PlusGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2 2l6 6M8 2l-6 6" />
    </svg>
  );
}
