import { useState } from "react";
import type { WorldFile } from "@/types/world";
import {
  countReferences,
  renameRoom,
  renameMob,
  renameItem,
  renameQuest,
  type EntityCategory,
} from "@/lib/refactorId";
import { useFocusTrap } from "@/lib/useFocusTrap";

type RenamableCategory = Extract<EntityCategory, "room" | "mob" | "item" | "quest">;

const COLLECTION_BY_CATEGORY: Record<RenamableCategory, "rooms" | "mobs" | "items" | "quests"> = {
  room: "rooms",
  mob: "mobs",
  item: "items",
  quest: "quests",
};

const LABELS: Record<RenamableCategory, { singular: string; placeholder: string }> = {
  room: { singular: "Room", placeholder: "e.g. tavern_back_room" },
  mob: { singular: "Mob", placeholder: "e.g. grizzled_innkeeper" },
  item: { singular: "Item", placeholder: "e.g. iron_sword" },
  quest: { singular: "Quest", placeholder: "e.g. rescue_the_scholar" },
};

interface RenameEntityDialogProps {
  category: RenamableCategory;
  currentId: string;
  world: WorldFile;
  onConfirm: (nextWorld: WorldFile, newId: string) => void;
  onClose: () => void;
}

export function RenameEntityDialog({
  category,
  currentId,
  world,
  onConfirm,
  onClose,
}: RenameEntityDialogProps) {
  const [newId, setNewId] = useState(currentId);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const label = LABELS[category];
  const collection = COLLECTION_BY_CATEGORY[category];
  const existingIds = world[collection] ? Object.keys(world[collection]!) : [];

  const trimmedId = newId.trim().toLowerCase().replace(/\s+/g, "_");
  const idValid = /^[a-z][a-z0-9_]*$/.test(trimmedId);
  const idUnchanged = trimmedId === currentId;
  const idTaken = !idUnchanged && existingIds.includes(trimmedId);

  const refCount = idUnchanged ? 0 : countReferences(world, category, currentId);

  const titleId = `rename-entity-dialog-${category}-title`;

  const handleRename = () => {
    if (!idValid || idTaken || idUnchanged) return;
    let next: WorldFile;
    switch (category) {
      case "room":
        next = renameRoom(world, currentId, trimmedId);
        break;
      case "mob":
        next = renameMob(world, currentId, trimmedId);
        break;
      case "item":
        next = renameItem(world, currentId, trimmedId);
        break;
      case "quest":
        next = renameQuest(world, currentId, trimmedId);
        break;
    }
    onConfirm(next, trimmedId);
    onClose();
  };

  const blocked = !idValid || idTaken || idUnchanged;

  return (
    <div className="modal-overlay">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        <div className="border-b border-border-default px-5 py-3">
          <h2 id={titleId} className="font-display text-sm tracking-wide text-text-primary">
            Rename {label.singular}
          </h2>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Current ID
            </label>
            <div className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 font-mono text-xs leading-8 text-text-muted">
              {currentId}
            </div>
          </div>

          <div>
            <label
              htmlFor="rename-entity-new-id"
              className="mb-1 block text-2xs uppercase tracking-wider text-text-muted"
            >
              New ID
            </label>
            <input
              id="rename-entity-new-id"
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !blocked) {
                  e.preventDefault();
                  handleRename();
                }
              }}
              placeholder={label.placeholder}
              autoFocus
              aria-describedby={
                newId && !idValid
                  ? "rename-entity-format-error"
                  : idTaken
                    ? "rename-entity-taken-error"
                    : undefined
              }
              className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
            />
            {newId && !idValid && (
              <span
                role="alert"
                id="rename-entity-format-error"
                className="mt-1 block text-2xs text-status-error"
              >
                Must start with a letter, only lowercase letters, numbers, and underscores.
              </span>
            )}
            {idTaken && (
              <span
                role="alert"
                id="rename-entity-taken-error"
                className="mt-1 block text-2xs text-status-error"
              >
                {label.singular.toLowerCase()} "{trimmedId}" already exists in this zone.
              </span>
            )}
          </div>

          {refCount > 0 ? (
            <p className="rounded border border-status-info/30 bg-status-info/5 px-3 py-2 text-2xs leading-relaxed text-status-info">
              <strong>{refCount}</strong>{" "}
              {refCount === 1 ? "reference" : "references"} to{" "}
              <span className="font-mono">{currentId}</span>{" "}
              {refCount === 1 ? "is" : "are"} in this zone and will be updated
              automatically.
            </p>
          ) : (
            <p className="rounded border border-border-muted bg-bg-primary/50 px-3 py-2 text-2xs leading-relaxed text-text-muted">
              No references in this zone — only the {label.singular.toLowerCase()} itself will be renamed.
            </p>
          )}

          <p className="rounded border border-status-warning/30 bg-status-warning/5 px-3 py-2 text-2xs leading-relaxed text-status-warning">
            Cross-zone references (other zones&apos; quest links, drops, exit
            targets, starter equipment, etc.) will <strong>not</strong> be
            updated automatically. Review them after renaming.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRename}
            disabled={blocked}
            className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-[color,background-color,box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Rename {label.singular}
          </button>
        </div>
      </div>
    </div>
  );
}
