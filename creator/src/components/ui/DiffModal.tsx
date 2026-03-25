import { useEffect, useState } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { serializeZone } from "@/lib/saveZone";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { diffLines, type DiffLine } from "@/lib/diff";

interface FileDiff {
  label: string;
  lines: DiffLine[];
  changeCount: number;
}

interface DiffModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiffModal({ onConfirm, onCancel }: DiffModalProps) {
  const [diffs, setDiffs] = useState<FileDiff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(onCancel);

  useEffect(() => {
    computeDiffs().then(setDiffs).catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="diff-dialog-title" className="mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 id="diff-dialog-title" className="font-display text-sm tracking-wide text-text-primary">
            Review Changes
          </h2>
          <span className="text-xs text-text-muted">
            {diffs ? `${diffs.length} file${diffs.length !== 1 ? "s" : ""}` : "Loading..."}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {error && (
            <p className="text-xs text-status-error">{error}</p>
          )}
          {!diffs && !error && (
            <p className="text-xs text-text-muted">Computing diffs...</p>
          )}
          {diffs?.map((diff) => (
            <div key={diff.label} className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">
                  {diff.label}
                </span>
                <span className="text-2xs text-text-muted">
                  {diff.changeCount} change{diff.changeCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="max-h-64 overflow-auto rounded border border-border-default bg-bg-primary font-mono text-[11px] leading-5">
                {diff.lines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.kind === "add"
                        ? "bg-diff-add-bg text-diff-add-text"
                        : line.kind === "del"
                          ? "bg-diff-del-bg text-diff-del-text"
                          : "text-text-muted"
                    }
                  >
                    <span className="inline-block w-5 select-none text-right opacity-50">
                      {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
                    </span>
                    {" "}{line.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!diffs}
            className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:opacity-50"
          >
            Save All
          </button>
        </div>
      </div>
    </div>
  );
}

async function computeDiffs(): Promise<FileDiff[]> {
  const result: FileDiff[] = [];
  const zones = useZoneStore.getState().zones;

  // Dirty zones
  for (const [zoneId, zone] of zones) {
    if (!zone.dirty) continue;
    let oldText = "";
    try {
      oldText = await readTextFile(zone.filePath);
    } catch {
      // New file, no old content
    }
    const newText = serializeZone(zoneId);
    if (oldText === newText) continue;
    const lines = diffLines(oldText, newText);
    const changeCount = lines.filter((l) => l.kind !== "same").length;
    result.push({ label: `zone: ${zoneId}`, lines, changeCount });
  }

  // Dirty config
  const configStore = useConfigStore.getState();
  if (configStore.dirty && configStore.config) {
    const mudDir = useProjectStore.getState().project?.mudDir;
    if (mudDir) {
      result.push({
        label: "config: application.yaml",
        lines: [{ kind: "same", text: "(Config uses CST-preserving save — full diff not available)" }],
        changeCount: 1,
      });
    }
  }

  return result;
}
