import type { CraftingStationTypeDefinition } from "@/types/config";
import { TextInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
import { TrashIcon } from "@/components/config/icons";

interface StationTypeDesignerProps {
  id: string;
  station: CraftingStationTypeDefinition;
  onPatch: (p: Partial<CraftingStationTypeDefinition>) => void;
  onDelete: () => void;
}

export function StationTypeDesigner({
  id,
  station,
  onPatch,
  onDelete,
}: StationTypeDesignerProps) {
  return (
    <SectionCard
      title="Station Type Designer"
      actions={
        <button
          type="button"
          onClick={onDelete}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-2.5 py-1.5 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
        >
          <TrashIcon />
          Delete Type
        </button>
      }
    >
      <div className="flex items-center gap-3 border-b border-[var(--chrome-stroke)] pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display text-xl font-semibold text-text-primary">
              {station.displayName || id}
            </h4>
            <ActiveBadge />
          </div>
          <p className="mt-0.5 text-2xs text-text-muted/80">
            Configure how this station type appears and behaves.
          </p>
        </div>
      </div>

      <p className="mt-1 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
        Basic Information
      </p>

      <div className="flex flex-col gap-1">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          Display Name
        </span>
        <TextInput
          value={station.displayName}
          onCommit={(v) => onPatch({ displayName: v })}
          placeholder="Forge"
          dense
        />
        <p className="text-2xs leading-snug text-text-muted/70">
          Name shown to players (e.g. Forge, Alchemy Table, Loom).
        </p>
      </div>
    </SectionCard>
  );
}

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-status-success/30 bg-status-success/10 px-1.5 py-0.5 font-display text-[0.55rem] font-semibold uppercase tracking-wider text-status-success">
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-status-success"
      />
      Active
    </span>
  );
}
