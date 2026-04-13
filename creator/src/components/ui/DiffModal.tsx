import { useEffect, useState } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { serializeZone } from "@/lib/saveZone";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { diffLines, type DiffLine } from "@/lib/diff";
import { ActionButton, DialogShell } from "./FormWidgets";

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
    <DialogShell
      dialogRef={trapRef}
      titleId="diff-dialog-title"
      title="Review Pending Changes"
      subtitle="Trace every altered surface before the world is committed to disk."
      widthClassName="max-w-4xl"
      onClose={onCancel}
      status={
        <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1 text-2xs text-text-secondary">
          {diffs ? `${diffs.length} file${diffs.length !== 1 ? "s" : ""}` : "Reading changes"}
        </span>
      }
      footer={
        <>
          <ActionButton onClick={onCancel} variant="ghost">
            Cancel
          </ActionButton>
          <ActionButton onClick={onConfirm} disabled={!diffs} variant="primary">
            Save All
          </ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="flex items-center justify-between rounded-3xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            <span>{error}</span>
            <button
              onClick={() => {
                setError(null);
                setDiffs(null);
                computeDiffs().then(setDiffs).catch((e) => setError(String(e)));
              }}
              className="ml-3 shrink-0 rounded-full border border-status-error/30 px-3 py-1 text-xs text-status-error transition-colors hover:bg-status-error/20"
            >
              Retry
            </button>
          </div>
        )}
        {!diffs && !error && (
          <div className="panel-surface-light rounded-3xl px-4 py-6 text-sm text-text-muted">
            Reading the current zone and config deltas...
          </div>
        )}
        {diffs?.map((diff) => (
          <section key={diff.label} className="panel-surface-light rounded-3xl p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-sm text-text-primary">{diff.label}</h3>
              <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1 text-2xs text-text-secondary">
                {diff.changeCount} change{diff.changeCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-72 overflow-auto rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--bg-scrim-code)] font-mono text-2xs leading-5">
              {diff.lines.map((line, index) => (
                <div
                  key={index}
                  className={
                    line.kind === "add"
                      ? "bg-diff-add-bg/90 text-diff-add-text"
                      : line.kind === "del"
                        ? "bg-diff-del-bg/90 text-diff-del-text"
                        : "text-text-muted"
                  }
                >
                  <span className="inline-block w-6 select-none pl-2 text-right opacity-50">
                    {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
                  </span>
                  {" "}
                  {line.text}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </DialogShell>
  );
}

async function computeDiffs(): Promise<FileDiff[]> {
  const result: FileDiff[] = [];
  const zones = useZoneStore.getState().zones;

  for (const [zoneId, zone] of zones) {
    if (!zone.dirty) continue;
    let oldText = "";
    try {
      oldText = await readTextFile(zone.filePath);
    } catch {
      // New file, no old content.
    }
    const newText = serializeZone(zoneId);
    if (oldText === newText) continue;
    const lines = diffLines(oldText, newText);
    const changeCount = lines.filter((line) => line.kind !== "same").length;
    result.push({ label: `zone: ${zoneId}`, lines, changeCount });
  }

  const configStore = useConfigStore.getState();
  if (configStore.dirty && configStore.config) {
    const mudDir = useProjectStore.getState().project?.mudDir;
    if (mudDir) {
      result.push({
        label: "config: application.yaml",
        lines: [{ kind: "same", text: "(Config uses CST-preserving save; a full line diff is not available.)" }],
        changeCount: 1,
      });
    }
  }

  return result;
}
