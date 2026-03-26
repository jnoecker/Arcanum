import { useState } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, SelectInput, TextInput } from "@/components/ui/FormWidgets";

const LOG_LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"];

export function LoggingPanel({ config, onChange }: ConfigPanelProps) {
  const l = config.logging;
  const patch = (p: Partial<AppConfig["logging"]>) =>
    onChange({ logging: { ...l, ...p } });

  const [newPkg, setNewPkg] = useState("");

  const packageEntries = Object.entries(l.packageLevels).sort(([a], [b]) => a.localeCompare(b));

  const updatePackageLevel = (pkg: string, level: string) => {
    patch({ packageLevels: { ...l.packageLevels, [pkg]: level } });
  };

  const removePackageLevel = (pkg: string) => {
    const next = { ...l.packageLevels };
    delete next[pkg];
    patch({ packageLevels: next });
  };

  const addPackageLevel = () => {
    const trimmed = newPkg.trim();
    if (!trimmed || trimmed in l.packageLevels) return;
    patch({ packageLevels: { ...l.packageLevels, [trimmed]: "INFO" } });
    setNewPkg("");
  };

  return (
    <>
      <Section
        title="Root level"
        description="The default log level for all packages unless overridden below."
      >
        <FieldRow label="Log Level" hint="TRACE and DEBUG are verbose. INFO is recommended for production. WARN and ERROR suppress informational messages.">
          <SelectInput
            value={l.level}
            options={LOG_LEVELS.map((lv) => ({ value: lv, label: lv }))}
            onCommit={(v) => patch({ level: v })}
          />
        </FieldRow>
      </Section>

      <Section
        title="Package overrides"
        description="Set different log levels for specific packages. Useful for debugging a single system without flooding the console."
      >
        <div className="flex flex-col gap-1.5">
          {packageEntries.map(([pkg, level]) => (
            <div key={pkg} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary" title={pkg}>
                {pkg}
              </span>
              <div className="w-24">
                <SelectInput
                  value={level}
                  options={LOG_LEVELS.map((lv) => ({ value: lv, label: lv }))}
                  onCommit={(v) => updatePackageLevel(pkg, v)}
                />
              </div>
              <button
                onClick={() => removePackageLevel(pkg)}
                className="shrink-0 rounded px-2 py-0.5 text-2xs text-text-muted hover:text-status-error focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
                title="Remove override"
              >
                Remove
              </button>
            </div>
          ))}

          {packageEntries.length === 0 && (
            <p className="text-xs text-text-muted">No package-level overrides. All packages use the root level.</p>
          )}

          <div className="mt-2 flex items-center gap-2">
            <TextInput
              value={newPkg}
              onCommit={() => addPackageLevel()}
              placeholder="dev.ambon.transport"
            />
            <button
              onClick={addPackageLevel}
              disabled={!newPkg.trim()}
              className="shrink-0 rounded-xl border border-white/10 bg-black/10 px-3 py-1 text-2xs text-text-primary transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
            >
              Add
            </button>
          </div>
        </div>
      </Section>
    </>
  );
}
