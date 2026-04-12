import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLoreStore } from "@/stores/loreStore";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import type { ArticleTemplate } from "@/types/lore";
import {
  buildCandidates,
  candidateToArticle,
  uniqueLoreId,
  KIND_LABELS,
  EMPTY_SELECTION,
  type WorldbuilderCandidate,
  type WorldbuilderSelection,
  type SourceKind,
} from "@/lib/worldbuilderImport";

type WizardStep = "select" | "review" | "done";

const CONFIG_KIND_KEYS: Extract<SourceKind, "race" | "class" | "ability" | "statusEffect" | "pet">[] = [
  "race",
  "class",
  "ability",
  "statusEffect",
  "pet",
];

const ZONE_KIND_KEYS: Extract<SourceKind, "mob" | "item" | "shop" | "quest" | "recipe" | "gatheringNode">[] = [
  "mob",
  "item",
  "shop",
  "quest",
  "recipe",
  "gatheringNode",
];

const TEMPLATE_OPTIONS = Object.entries(TEMPLATE_SCHEMAS).map(([key, s]) => ({
  value: key,
  label: s.label,
}));

export function WorldbuilderImportWizard({ onClose }: { onClose: () => void }) {
  const config = useConfigStore((s) => s.config);
  const zones = useZoneStore((s) => s.zones);
  const articles = useLoreStore((s) => s.lore?.articles ?? {});
  const createArticle = useLoreStore((s) => s.createArticle);
  const updateArticle = useLoreStore((s) => s.updateArticle);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const [step, setStep] = useState<WizardStep>("select");
  const [selection, setSelection] = useState<WorldbuilderSelection>(() => ({
    config: { ...EMPTY_SELECTION.config },
    zones: {},
  }));
  const [candidates, setCandidates] = useState<WorldbuilderCandidate[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [overwrittenCount, setOverwrittenCount] = useState(0);
  const [firstImportedId, setFirstImportedId] = useState<string | null>(null);

  // ─── Zone list ────────────────────────────────────────────────
  const sortedZones = useMemo(
    () => Array.from(zones.keys()).sort((a, b) => a.localeCompare(b)),
    [zones],
  );

  // ─── Config toggles ───────────────────────────────────────────
  const toggleConfigKind = (kind: (typeof CONFIG_KIND_KEYS)[number]) => {
    setSelection((prev) => ({
      ...prev,
      config: { ...prev.config, [kind]: !prev.config[kind] },
    }));
  };

  const toggleAllConfig = () => {
    const allOn = CONFIG_KIND_KEYS.every((k) => selection.config[k]);
    const next = !allOn;
    setSelection((prev) => ({
      ...prev,
      config: CONFIG_KIND_KEYS.reduce(
        (acc, k) => ({ ...acc, [k]: next }),
        {} as WorldbuilderSelection["config"],
      ),
    }));
  };

  // ─── Zone toggles ─────────────────────────────────────────────
  const toggleZoneKind = (zoneId: string, kind: (typeof ZONE_KIND_KEYS)[number]) => {
    setSelection((prev) => {
      const zoneSel = prev.zones[zoneId] ?? {};
      return {
        ...prev,
        zones: {
          ...prev.zones,
          [zoneId]: { ...zoneSel, [kind]: !zoneSel[kind] },
        },
      };
    });
  };

  const toggleZoneRow = (zoneId: string) => {
    setSelection((prev) => {
      const zoneSel = prev.zones[zoneId] ?? {};
      const allOn = ZONE_KIND_KEYS.every((k) => zoneSel[k]);
      const next = !allOn;
      return {
        ...prev,
        zones: {
          ...prev.zones,
          [zoneId]: ZONE_KIND_KEYS.reduce(
            (acc, k) => ({ ...acc, [k]: next }),
            {} as NonNullable<WorldbuilderSelection["zones"][string]>,
          ),
        },
      };
    });
  };

  const toggleAllZones = () => {
    const allOn =
      sortedZones.length > 0 &&
      sortedZones.every((zid) => {
        const zs = selection.zones[zid];
        return zs && ZONE_KIND_KEYS.every((k) => zs[k]);
      });
    const next = !allOn;
    setSelection((prev) => ({
      ...prev,
      zones: sortedZones.reduce(
        (acc, zid) => ({
          ...acc,
          [zid]: ZONE_KIND_KEYS.reduce(
            (inner, k) => ({ ...inner, [k]: next }),
            {} as NonNullable<WorldbuilderSelection["zones"][string]>,
          ),
        }),
        {} as WorldbuilderSelection["zones"],
      ),
    }));
  };

  // ─── Scan ────────────────────────────────────────────────────
  const handleScan = useCallback(() => {
    const built = buildCandidates(config, zones, selection, articles);
    setCandidates(built);
    setStep("review");
  }, [config, zones, selection, articles]);

  // ─── Review-step mutations ───────────────────────────────────
  const toggleCandidate = (idx: number) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c)),
    );
  };

  const setCandidateTemplate = (idx: number, template: ArticleTemplate) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, template } : c)),
    );
  };

  const toggleAllCandidates = () => {
    const allSelected = candidates.every((c) => c.selected);
    setCandidates((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  };

  const anyExisting = candidates.some((c) => c.existingArticleId !== null);
  const selectedCount = candidates.filter((c) => c.selected).length;

  // ─── Import ──────────────────────────────────────────────────
  const handleImport = useCallback(() => {
    const toImport = candidates.filter((c) => {
      if (!c.selected) return false;
      if (c.existingArticleId !== null && !overwriteExisting) return false;
      return true;
    });

    const usedIds = new Set(Object.keys(articles));
    let created = 0;
    let overwritten = 0;
    let firstId: string | null = null;

    for (const c of toImport) {
      if (c.existingArticleId !== null) {
        // Overwrite existing: update fields/content/template/title, keep id
        const id = c.existingArticleId;
        const article = candidateToArticle(c, id);
        updateArticle(id, {
          template: article.template,
          title: article.title,
          fields: article.fields,
          content: article.content,
          draft: true,
        });
        overwritten++;
        if (!firstId) firstId = id;
      } else {
        const id = uniqueLoreId(c.loreId, usedIds);
        usedIds.add(id);
        const article = candidateToArticle(c, id);
        createArticle(article);
        created++;
        if (!firstId) firstId = id;
      }
    }

    setImportedCount(created);
    setOverwrittenCount(overwritten);
    setFirstImportedId(firstId);
    setStep("done");
  }, [candidates, overwriteExisting, articles, createArticle, updateArticle]);

  const handleOpenFirst = () => {
    if (firstImportedId) selectArticle(firstImportedId);
    onClose();
  };

  // ─── Render ──────────────────────────────────────────────────
  const hasAnySelection =
    CONFIG_KIND_KEYS.some((k) => selection.config[k]) ||
    Object.values(selection.zones).some(
      (zs) => zs && ZONE_KIND_KEYS.some((k) => zs[k]),
    );

  const existingSkipCount = candidates.filter(
    (c) => c.selected && c.existingArticleId !== null && !overwriteExisting,
  ).length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-surface-scrim" onClick={onClose} />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Import from worldbuilder"
        className="relative flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-[var(--chrome-stroke)] bg-bg-primary shadow-[0_24px_80px_rgba(8,10,18,0.6)]"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--chrome-stroke)] px-6 py-4">
          <h2 className="font-display text-lg text-text-primary">
            Import from Worldbuilder
          </h2>
          <p className="mt-1 text-2xs text-text-secondary">
            {step === "select" &&
              "Turn config entities and zone content into lore article drafts."}
            {step === "review" &&
              `${candidates.length} candidate${candidates.length !== 1 ? "s" : ""} found. Review before importing.`}
            {step === "done" &&
              `${importedCount + overwrittenCount} article${importedCount + overwrittenCount !== 1 ? "s" : ""} imported as drafts.`}
          </p>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {step === "select" && (
            <div className="space-y-6">
              {/* Config section */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-sm text-text-primary">Config</h3>
                  <button
                    onClick={toggleAllConfig}
                    className="text-2xs text-text-muted hover:text-text-secondary transition"
                  >
                    {CONFIG_KIND_KEYS.every((k) => selection.config[k])
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                </div>
                {!config && (
                  <p className="text-2xs text-status-warning">
                    No config loaded — open a project first.
                  </p>
                )}
                {config && (
                  <div className="grid grid-cols-2 gap-2">
                    {CONFIG_KIND_KEYS.map((kind) => {
                      const count = countConfigEntities(config, kind);
                      return (
                        <label
                          key={kind}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition ${
                            selection.config[kind]
                              ? "border-accent/30 bg-accent/5"
                              : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selection.config[kind]}
                            onChange={() => toggleConfigKind(kind)}
                            className="accent-accent"
                          />
                          <span className="flex-1 text-xs text-text-primary">
                            {pluralLabel(KIND_LABELS[kind])}
                          </span>
                          <span className="text-3xs text-text-muted">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Zones section */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-sm text-text-primary">Zones</h3>
                  <button
                    onClick={toggleAllZones}
                    disabled={sortedZones.length === 0}
                    className="text-2xs text-text-muted hover:text-text-secondary transition disabled:opacity-40"
                  >
                    Select all
                  </button>
                </div>
                {sortedZones.length === 0 && (
                  <p className="text-2xs text-text-muted">
                    No zones loaded.
                  </p>
                )}
                {sortedZones.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-[var(--chrome-stroke)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--chrome-fill)] text-text-muted">
                        <tr>
                          <th className="sticky left-0 z-10 bg-[var(--chrome-fill)] px-3 py-2 text-left font-normal">
                            Zone
                          </th>
                          {ZONE_KIND_KEYS.map((kind) => (
                            <th key={kind} className="px-2 py-2 text-center font-normal">
                              {pluralLabel(KIND_LABELS[kind])}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedZones.map((zoneId) => {
                          const zoneSel = selection.zones[zoneId] ?? {};
                          return (
                            <tr key={zoneId} className="border-t border-[var(--chrome-stroke)]">
                              <td className="sticky left-0 z-10 bg-bg-primary px-3 py-2">
                                <button
                                  onClick={() => toggleZoneRow(zoneId)}
                                  className="text-text-primary hover:text-accent transition"
                                  title="Toggle all entity kinds for this zone"
                                >
                                  {zoneId}
                                </button>
                              </td>
                              {ZONE_KIND_KEYS.map((kind) => {
                                const count = countZoneEntities(zones, zoneId, kind);
                                const disabled = count === 0;
                                return (
                                  <td key={kind} className="px-2 py-2 text-center">
                                    <label className={`inline-flex items-center gap-1 ${disabled ? "opacity-30" : "cursor-pointer"}`}>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(zoneSel[kind])}
                                        disabled={disabled}
                                        onChange={() => toggleZoneKind(zoneId, kind)}
                                        className="accent-accent"
                                      />
                                      <span className="text-3xs text-text-muted">{count}</span>
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-2">
              {candidates.length > 1 && (
                <div className="mb-1 flex items-center justify-between">
                  <button
                    onClick={toggleAllCandidates}
                    className="text-2xs text-text-muted hover:text-text-secondary transition"
                  >
                    {candidates.every((c) => c.selected) ? "Deselect all" : "Select all"}
                  </button>
                  {anyExisting && (
                    <label className="flex cursor-pointer items-center gap-2 text-2xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                        className="accent-accent"
                      />
                      Overwrite existing imports
                    </label>
                  )}
                </div>
              )}

              {anyExisting && !overwriteExisting && existingSkipCount > 0 && (
                <div className="mb-1 rounded-lg border border-status-info/30 bg-status-info/5 px-3 py-2 text-2xs text-status-info">
                  {existingSkipCount} candidate{existingSkipCount !== 1 ? "s" : ""} already imported and will be skipped. Tick "Overwrite existing imports" to force re-import.
                </div>
              )}

              {candidates.length === 0 && (
                <p className="py-6 text-center text-sm text-text-muted">
                  No matching entities found for your selection.
                </p>
              )}

              {candidates.map((c, i) => {
                const willOverwrite = c.existingArticleId !== null && overwriteExisting;
                const willSkip = c.existingArticleId !== null && !overwriteExisting;
                return (
                  <div
                    key={`${c.source.kind}:${c.source.zoneId ?? ""}:${c.source.sourceId}`}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                      c.selected && !willSkip
                        ? "border-accent/20 bg-accent/5"
                        : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={c.selected}
                      onChange={() => toggleCandidate(i)}
                      className="accent-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm text-text-primary">{c.title}</span>
                        {c.existingArticleId !== null && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-3xs ${
                              willOverwrite
                                ? "bg-status-warning/15 text-status-warning"
                                : "bg-bg-tertiary text-text-muted"
                            }`}
                          >
                            {willOverwrite ? "overwrite" : "exists"}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-3xs text-text-muted">
                        {KIND_LABELS[c.source.kind]}
                        {c.source.zoneId && ` · ${c.source.zoneId}`}
                        {` · ${c.source.sourceId}`}
                      </div>
                    </div>
                    <select
                      value={c.template}
                      onChange={(e) => setCandidateTemplate(i, e.target.value as ArticleTemplate)}
                      className="ornate-input px-2 py-1 text-xs"
                    >
                      {TEMPLATE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="font-display text-lg text-accent">
                {importedCount} new · {overwrittenCount} overwritten
              </p>
              <p className="text-sm text-text-secondary">
                All imported articles are marked as drafts for review.
              </p>
              {firstImportedId && (
                <button
                  onClick={handleOpenFirst}
                  className="mt-2 focus-ring rounded-full border border-accent/30 bg-accent/10 px-5 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
                >
                  Open first imported article
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--chrome-stroke)] px-6 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-primary transition"
          >
            {step === "done" ? "Close" : "Cancel"}
          </button>
          <div className="flex items-center gap-2">
            {step === "review" && (
              <button
                onClick={() => setStep("select")}
                className="text-xs text-text-muted hover:text-text-primary transition"
              >
                Back
              </button>
            )}
            {step === "select" && (
              <button
                onClick={handleScan}
                disabled={!hasAnySelection}
                className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-5 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
              >
                Scan
              </button>
            )}
            {step === "review" && (
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || (existingSkipCount === selectedCount && !overwriteExisting)}
                className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-5 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
              >
                Import {selectedCount - (overwriteExisting ? 0 : existingSkipCount)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function pluralLabel(singular: string): string {
  if (singular.endsWith("y")) return singular.slice(0, -1) + "ies";
  if (singular.endsWith("s")) return singular;
  return singular + "s";
}

function countConfigEntities(
  config: import("@/types/config").AppConfig,
  kind: (typeof CONFIG_KIND_KEYS)[number],
): number {
  switch (kind) {
    case "race":
      return Object.keys(config.races ?? {}).length;
    case "class":
      return Object.keys(config.classes ?? {}).length;
    case "ability":
      return Object.keys(config.abilities ?? {}).length;
    case "statusEffect":
      return Object.keys(config.statusEffects ?? {}).length;
    case "pet":
      return Object.keys(config.pets ?? {}).length;
  }
}

function countZoneEntities(
  zones: Map<string, import("@/stores/zoneStore").ZoneState>,
  zoneId: string,
  kind: (typeof ZONE_KIND_KEYS)[number],
): number {
  const z = zones.get(zoneId);
  if (!z) return 0;
  switch (kind) {
    case "mob":
      return Object.keys(z.data.mobs ?? {}).length;
    case "item":
      return Object.keys(z.data.items ?? {}).length;
    case "shop":
      return Object.keys(z.data.shops ?? {}).length;
    case "quest":
      return Object.keys(z.data.quests ?? {}).length;
    case "recipe":
      return Object.keys(z.data.recipes ?? {}).length;
    case "gatheringNode":
      return Object.keys(z.data.gatheringNodes ?? {}).length;
  }
}
