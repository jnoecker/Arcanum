import { useState, useMemo } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { rethemeZone, type RethemeResult } from "@/lib/zoneRetheme";
import { useZoneStore } from "@/stores/zoneStore";
import { useToastStore } from "@/stores/toastStore";
import { useVibeStore } from "@/stores/vibeStore";
import { buildToneDirective } from "@/lib/loreGeneration";
import { ActionButton, Spinner } from "@/components/ui/FormWidgets";
import type { WorldFile } from "@/types/world";

interface RethemeDialogProps {
  zoneId: string;
  world: WorldFile;
  onClose: () => void;
}

export function RethemeDialog({ zoneId, world, onClose }: RethemeDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const updateZone = useZoneStore((s) => s.updateZone);
  const saveVibe = useVibeStore((s) => s.saveVibe);

  const [newTheme, setNewTheme] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RethemeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const elementCount = useMemo(() => {
    return (
      Object.keys(world.rooms).length +
      Object.keys(world.mobs ?? {}).length +
      Object.keys(world.items ?? {}).length
    );
  }, [world]);

  const handleRun = async () => {
    if (!newTheme.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await rethemeZone({
        world,
        newTheme: newTheme.trim(),
        worldTheme: buildToneDirective(),
      });
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    updateZone(zoneId, result.world);
    try {
      void saveVibe(zoneId, newTheme.trim());
    } catch {
      /* non-fatal */
    }
    useToastStore.getState().show(
      `Retheme applied: ${result.changedFieldCount} text fields rewritten`,
    );
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="retheme-dialog-title"
        className="mx-4 w-[32rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        <div className="border-b border-border-default px-5 py-3">
          <h2 id="retheme-dialog-title" className="font-display text-sm tracking-wide text-text-primary">
            Retheme Zone — {world.zone || zoneId}
          </h2>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-5 py-4">
          {!result && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-2xs uppercase tracking-wider text-text-muted">New theme</span>
                <textarea
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value)}
                  rows={3}
                  autoFocus
                  disabled={running}
                  placeholder="e.g. A sunken shipwreck overtaken by coral and bioluminescent creatures"
                  className="w-full rounded border border-border-default bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active disabled:opacity-60"
                />
              </label>

              <p className="rounded border border-border-default bg-bg-primary px-3 py-2 text-2xs leading-relaxed text-text-secondary">
                Rewrites titles and descriptions for <strong>{elementCount}</strong> entities (rooms, mobs, items).
                Exits, layout, IDs, stats, and drops are preserved. Art is <strong>not</strong> regenerated — use
                Batch Art after rethemig to refresh visuals.
              </p>

              <p className="rounded border border-status-warning/30 bg-status-warning/5 px-3 py-2 text-2xs leading-relaxed text-status-warning">
                Tip: Duplicate the zone first if you want to keep the original.
              </p>

              {error && <p className="text-xs text-status-error">{error}</p>}
            </>
          )}

          {result && (
            <>
              <div className="rounded border border-border-default bg-bg-primary px-3 py-2 text-xs text-text-secondary">
                Rewrote <strong className="text-text-primary">{result.changedFieldCount}</strong> text fields
                across <strong className="text-text-primary">{result.requestedElementCount}</strong> entities.
                {result.unmatchedRefCount > 0 && (
                  <span className="ml-1 text-status-warning">
                    ({result.unmatchedRefCount} unmatched refs ignored)
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                {Object.entries(result.world.rooms).slice(0, 8).map(([rid, room]) => {
                  const orig = world.rooms[rid];
                  if (!orig) return null;
                  const titleChanged = orig.title !== room.title;
                  const descChanged = orig.description !== room.description;
                  if (!titleChanged && !descChanged) return null;
                  return (
                    <div key={rid} className="rounded border border-border-default bg-bg-primary px-3 py-2 text-2xs">
                      <div className="mb-1 font-mono text-text-muted">{rid}</div>
                      {titleChanged && (
                        <div className="mb-1">
                          <span className="text-text-muted line-through">{orig.title}</span>
                          <span className="mx-1 text-text-muted">→</span>
                          <span className="text-accent">{room.title}</span>
                        </div>
                      )}
                      {descChanged && (
                        <div className="text-text-secondary">{room.description}</div>
                      )}
                    </div>
                  );
                })}
                {Object.keys(result.world.rooms).length > 8 && (
                  <p className="text-2xs text-text-muted">(First 8 rooms shown; apply to see the rest.)</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            disabled={running}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-60"
          >
            Cancel
          </button>
          {!result ? (
            <ActionButton onClick={handleRun} disabled={running || !newTheme.trim()} variant="primary" size="sm">
              {running ? <><Spinner className="mr-1.5" /> Rewriting...</> : "Retheme"}
            </ActionButton>
          ) : (
            <ActionButton onClick={handleApply} variant="primary" size="sm">
              Apply
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
