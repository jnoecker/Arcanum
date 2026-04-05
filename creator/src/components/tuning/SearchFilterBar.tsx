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
    <div className="sticky top-0 z-10 mt-12 mb-6 flex items-center gap-4 border-b border-border-muted bg-bg-primary px-6 pb-4">
      {/* Search input */}
      <input
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="Search parameters..."
        className="ornate-input flex-1 rounded px-3 py-2 font-sans text-[15px] text-text-primary"
      />

      {/* Section filter chips */}
      <div className="flex gap-2">
        {ALL_SECTIONS.map((section) => {
          const isActive = activeSections.has(section);
          return (
            <button
              key={section}
              type="button"
              onClick={() => toggleSection(section)}
              className={`cursor-pointer rounded-full border px-2 py-1 font-sans text-sm font-semibold uppercase tracking-[0.18em] transition-colors duration-150 ${
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
