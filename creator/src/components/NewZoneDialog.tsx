import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { zoneFilePath } from "@/lib/projectPaths";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { WorldFile } from "@/types/world";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

interface NewZoneDialogProps {
  onClose: () => void;
}

export function NewZoneDialog({ onClose }: NewZoneDialogProps) {
  const project = useProjectStore((s) => s.project);
  const loadZone = useZoneStore((s) => s.loadZone);
  const zones = useZoneStore((s) => s.zones);
  const openTab = useProjectStore((s) => s.openTab);

  const [zoneId, setZoneId] = useState("");
  const [startRoom, setStartRoom] = useState("entrance");
  const [roomTitle, setRoomTitle] = useState("Entrance");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const trimmedId = zoneId.trim().toLowerCase().replace(/\s+/g, "_");
  const idValid = /^[a-z][a-z0-9_]*$/.test(trimmedId);
  const idTaken = zones.has(trimmedId);

  const handleCreate = async () => {
    if (!project || !idValid || idTaken) return;

    setCreating(true);
    setError(null);

    try {
      const world: WorldFile = {
        zone: trimmedId,
        startRoom: startRoom.trim() || "entrance",
        rooms: {
          [startRoom.trim() || "entrance"]: {
            title: roomTitle.trim() || "Entrance",
            description: "A new room.",
          },
        },
      };

      // Create zone directory for standalone projects
      if (project.format === "standalone") {
        await invoke("create_zone_directory", {
          projectDir: project.mudDir,
          zoneId: trimmedId,
        });
      }

      const filePath = zoneFilePath(project, trimmedId);
      const yaml = stringify(world, YAML_OPTS);
      await writeTextFile(filePath, yaml);

      loadZone(trimmedId, filePath, world);
      openTab({ id: `zone:${trimmedId}`, kind: "zone", label: trimmedId });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="new-zone-dialog-title" className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        <div className="border-b border-border-default px-5 py-3">
          <h2 id="new-zone-dialog-title" className="font-display text-sm tracking-wide text-text-primary">
            New Zone
          </h2>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          {/* Zone ID */}
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Zone ID
            </label>
            <input
              type="text"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              placeholder="e.g. dark_forest"
              autoFocus
              className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
            />
            {zoneId && !idValid && (
              <p className="mt-1 text-2xs text-status-error">
                Must start with a letter, only lowercase letters, numbers, and underscores.
              </p>
            )}
            {idTaken && (
              <p className="mt-1 text-2xs text-status-error">
                Zone "{trimmedId}" already exists.
              </p>
            )}
          </div>

          {/* Start Room ID */}
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Start Room ID
            </label>
            <input
              type="text"
              value={startRoom}
              onChange={(e) => setStartRoom(e.target.value)}
              placeholder="entrance"
              className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>

          {/* Room Title */}
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Room Title
            </label>
            <input
              type="text"
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              placeholder="Entrance"
              className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>

          {error && (
            <p className="text-xs text-status-error">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!idValid || idTaken || creating || !project}
            className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Creating..." : "Create Zone"}
          </button>
        </div>
      </div>
    </div>
  );
}
