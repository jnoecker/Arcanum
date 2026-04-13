// ─── Search & Filter Bar ────────────────────────────────────────────
// Sticky bar with debounced search input and section filter chips.

import { useState, useEffect } from "react";
import { useTuningWizardStore } from "@/stores/tuningWizardStore";
import { TuningSection } from "@/lib/tuning/types";

const ALL_SECTIONS = [
  TuningSection.CombatStats,
  TuningSection.EconomyCrafting,
  TuningSection.ProgressionQuests,
  TuningSection.WorldSocial,
] as const;

export function SearchFilterBar() {
  const searchQuery = useTuningWizardStore((s) => s.searchQuery);
  const setSearchQuery = useTuningWizardStore((s) => s.setSearchQuery);
  const activeSections = useTuningWizardStore((s) => s.activeSections);
  const toggleSection = useTuningWizardStore((s) => s.toggleSection);

  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Debounce: push local value to store after 150ms
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(localQuery), 150);
    return () => clearTimeout(timer);
  }, [localQuery, setSearchQuery]);

  // Sync from store when searchQuery changes externally (e.g., reset)
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  return (
    <div className="sticky top-0 z-10 mt-12 mb-6 flex flex-wrap items-center gap-3 border-b border-border-muted bg-bg-primary/95 px-6 pb-4 pt-2">
      {/* Search input */}
      <input
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="Search parameters..."
        aria-label="Search tuning parameters"
        className="ornate-input min-h-11 min-w-[12rem] flex-1 px-3 py-2 text-[15px] text-text-primary"
      />

      {/* Section filter chips */}
      <div className="flex flex-wrap gap-2" aria-label="Section filters">
        {ALL_SECTIONS.map((section) => {
          const isActive = activeSections.has(section);
          return (
            <button
              key={section}
              type="button"
              onClick={() => toggleSection(section)}
              aria-pressed={isActive}
              className={`focus-ring min-h-11 cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] transition-colors duration-150 ${
                isActive
                  ? "border-accent/[0.35] bg-accent/[0.14] text-accent"
                  : "border-border-muted bg-bg-secondary text-text-muted"
              }`}
            >
              {section}
            </button>
          );
        })}
      </div>
    </div>
  );
}
