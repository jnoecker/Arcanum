import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorldFile, ExitValue, DoorFile } from "@/types/world";
import {
  updateRoom,
  deleteRoom,
  addExit,
  deleteExit,
  updateExit,
  addMob,
  addItem,
  addShop,
  addTrainer,
  addGatheringNode,
  addPuzzle,
  defaultPuzzle,
  generateEntityId,
  OPPOSITE,
  normalizeDir,
} from "@/lib/zoneEdits";
import { ExitDoorEditor } from "./ExitDoorEditor";
import { RoomFeaturesEditor } from "./RoomFeaturesEditor";
import { EditableField, EditableTextArea, Section, IconButton, FieldRow, TextInput, SelectInput, CheckboxInput } from "@/components/ui/FormWidgets";
import { YamlPreview } from "@/components/ui/YamlPreview";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { MusicGenerator } from "@/components/ui/MusicGenerator";
import { VideoGenerator } from "@/components/ui/VideoGenerator";
import { roomPrompt, roomContext } from "@/lib/entityPrompts";
import { getTrainerClasses } from "@/lib/trainers";
import { EnhanceDescriptionButton } from "@/components/editors/EditorShared";
import { useVibeStore } from "@/stores/vibeStore";
import { useAssetStore } from "@/stores/assetStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { ZoneVibePanel } from "./ZoneVibePanel";
import sidebarBg from "@/assets/sidebar-bg.png";

export type EntityKind = "mob" | "item" | "shop" | "trainer" | "quest" | "gatheringNode" | "recipe" | "puzzle";

export interface EntitySelection {
  kind: EntityKind;
  id: string;
}

interface RoomPanelProps {
  zoneId: string;
  roomId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onClose: () => void;
  onRoomDeleted: () => void;
  onSelectEntity: (selection: EntitySelection) => void;
}

interface ExitDraft {
  direction: string;
  target: string;
  bidirectional: boolean;
}

const EXIT_DIRECTION_OPTIONS = [
  { value: "", label: "Choose..." },
  { value: "n", label: "North" },
  { value: "s", label: "South" },
  { value: "e", label: "East" },
  { value: "w", label: "West" },
  { value: "ne", label: "Northeast" },
  { value: "nw", label: "Northwest" },
  { value: "se", label: "Southeast" },
  { value: "sw", label: "Southwest" },
  { value: "u", label: "Up" },
  { value: "d", label: "Down" },
] as const;

const FALLBACK_STATION_OPTIONS = [
  { value: "forge", label: "Forge" },
  { value: "alchemy_table", label: "Alchemy Table" },
  { value: "workbench", label: "Workbench" },
  { value: "enchanting_table", label: "Enchanting Table" },
] as const;

function buildExitDraft(direction = ""): ExitDraft {
  return { direction, target: "", bidirectional: true };
}

function nextExitDirection(exits: Record<string, string | ExitValue> | undefined): string {
  return EXIT_DIRECTION_OPTIONS.find((option) => option.value && !exits?.[option.value])?.value ?? "";
}

function resolveExitTarget(exit: string | ExitValue): {
  target: string;
  door?: DoorFile;
  hasDoor: boolean;
  isLocked: boolean;
  keyItem?: string;
} {
  if (typeof exit === "string") {
    return { target: exit, hasDoor: false, isLocked: false };
  }
  const state = exit.door?.initialState?.toLowerCase() ?? (exit.door?.locked ? "locked" : undefined);
  return {
    target: exit.to,
    door: exit.door,
    hasDoor: !!exit.door,
    isLocked: state === "locked",
    keyItem: exit.door?.keyItemId ?? exit.door?.key,
  };
}

function isBidirectionalExit(
  world: WorldFile,
  sourceRoomId: string,
  direction: string,
  target: string,
): boolean {
  if (target.includes(":")) return false;
  const reverseDirection = OPPOSITE[direction];
  if (!reverseDirection) return false;
  const reverseExit = world.rooms[target]?.exits?.[reverseDirection];
  if (!reverseExit) return false;
  const reverseTarget = typeof reverseExit === "string" ? reverseExit : reverseExit.to;
  return reverseTarget === sourceRoomId;
}

function resolveExitInput(
  rawValue: string,
  currentZoneId: string,
  world: WorldFile,
  loadedZones: Map<string, { data: WorldFile }>,
): string {
  const value = rawValue.trim();
  if (!value) return "";

  if (!value.includes(":")) {
    if (world.rooms[value]) return value;
    const localMatches = Object.keys(world.rooms).filter((roomId) => roomId.startsWith(value));
    if (localMatches.length === 1) return localMatches[0]!;
    return value;
  }

  const parts = value.split(":", 2);
  const zonePrefix = (parts[0] ?? "").trim();
  const roomPrefixRaw = parts[1] ?? "";
  const roomPrefix = roomPrefixRaw.trim();
  if (!zonePrefix) return value;

  const exactZone = loadedZones.get(zonePrefix);
  const matchedZoneId = exactZone
    ? zonePrefix
    : [...loadedZones.keys()].find((loadedZoneId) => loadedZoneId.startsWith(zonePrefix));
  if (!matchedZoneId) return value;

  const zone = loadedZones.get(matchedZoneId)?.data;
  if (!zone) return value;
  if (matchedZoneId === currentZoneId) {
    if (!roomPrefix) return zone.startRoom;
    if (zone.rooms[roomPrefix]) return roomPrefix;
    const localMatches = Object.keys(zone.rooms).filter((roomId) => roomId.startsWith(roomPrefix));
    return localMatches.length === 1 ? localMatches[0]! : roomPrefix;
  }

  if (!roomPrefix) return `${matchedZoneId}:${zone.startRoom}`;
  if (zone.rooms[roomPrefix]) return `${matchedZoneId}:${roomPrefix}`;
  const roomMatches = Object.keys(zone.rooms).filter((roomId) => roomId.startsWith(roomPrefix));
  return roomMatches.length === 1 ? `${matchedZoneId}:${roomMatches[0]}` : `${matchedZoneId}:${roomPrefix}`;
}

export function RoomPanel({
  zoneId,
  roomId,
  world,
  onWorldChange,
  onClose,
  onRoomDeleted,
  onSelectEntity,
}: RoomPanelProps) {
  const [showYaml, setShowYaml] = useState(false);
  const [expandedDoor, setExpandedDoor] = useState<string | null>(null);
  const [exitDrafts, setExitDrafts] = useState<Record<string, ExitDraft>>({});
  const [newExitDraft, setNewExitDraft] = useState<ExitDraft>(() => buildExitDraft());
  const [exitError, setExitError] = useState<string | null>(null);
  const vibe = useVibeStore((s) => s.getVibe(zoneId));
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const loadedZones = useZoneStore((s) => s.zones);
  const craftingStationTypes = useConfigStore((s) => s.config?.craftingStationTypes);
  const room = world.rooms[roomId];
  if (!room) return null;

  const isStartRoom = roomId === world.startRoom;

  const stationOptions = useMemo(() => {
    if (craftingStationTypes && Object.keys(craftingStationTypes).length > 0) {
      return Object.entries(craftingStationTypes).map(([id, stationType]) => ({
        value: id,
        label: stationType.displayName || id,
      }));
    }
    return [...FALLBACK_STATION_OPTIONS];
  }, [craftingStationTypes]);

  const exits = useMemo(
    () =>
      Object.entries(room.exits ?? {}).map(([dir, val]) => ({
        direction: dir,
        ...resolveExitTarget(val),
        isBidirectional: isBidirectionalExit(world, roomId, dir, resolveExitTarget(val).target),
      })),
    [room.exits, roomId, world],
  );

  useEffect(() => {
    setExitDrafts(
      Object.fromEntries(
        exits.map((exit) => [
          exit.direction,
          {
            direction: exit.direction,
            target: exit.target,
            bidirectional: exit.isBidirectional,
          },
        ]),
      ),
    );
    setNewExitDraft(buildExitDraft(nextExitDirection(room.exits)));
    setExpandedDoor((current) => (current && room.exits?.[current] ? current : null));
    setExitError(null);
  }, [exits, room.exits]);

  const exitSuggestions = useMemo(() => {
    const localRoomIds = Object.keys(world.rooms).sort();
    const foreignZones = [...loadedZones.entries()]
      .filter(([loadedZoneId]) => loadedZoneId !== zoneId)
      .sort(([a], [b]) => a.localeCompare(b));

    const suggestions = new Set<string>(localRoomIds);
    for (const [foreignZoneId, foreignZoneState] of foreignZones) {
      suggestions.add(`${foreignZoneId}:`);
      suggestions.add(`${foreignZoneId}:${foreignZoneState.data.startRoom}`);
      for (const foreignRoomId of Object.keys(foreignZoneState.data.rooms).slice(0, 50)) {
        suggestions.add(`${foreignZoneId}:${foreignRoomId}`);
      }
    }
    return [...suggestions];
  }, [loadedZones, world.rooms, zoneId]);

  // Find entities in this room
  const mobs = useMemo(
    () => Object.entries(world.mobs ?? {}).filter(([, m]) => m.room === roomId),
    [world.mobs, roomId],
  );
  const items = useMemo(
    () => Object.entries(world.items ?? {}).filter(([, i]) => i.room === roomId),
    [world.items, roomId],
  );
  const shops = useMemo(
    () => Object.entries(world.shops ?? {}).filter(([, s]) => s.room === roomId),
    [world.shops, roomId],
  );
  const trainers = useMemo(
    () => Object.entries(world.trainers ?? {}).filter(([, t]) => t.room === roomId),
    [world.trainers, roomId],
  );
  const gatheringNodes = useMemo(
    () =>
      Object.entries(world.gatheringNodes ?? {}).filter(
        ([, g]) => g.room === roomId,
      ),
    [world.gatheringNodes, roomId],
  );
  const quests = useMemo(
    () =>
      Object.entries(world.quests ?? {}).filter(([, q]) => {
        const giverMob = Object.entries(world.mobs ?? {}).find(
          ([mobId]) => mobId === q.giver || `${zoneId}:${mobId}` === q.giver,
        );
        return giverMob && giverMob[1].room === roomId;
      }),
    [world.quests, world.mobs, zoneId, roomId],
  );
  const puzzles = useMemo(
    () => Object.entries(world.puzzles ?? {}).filter(([, p]) => p.roomId === roomId),
    [world.puzzles, roomId],
  );

  const handleFieldChange = useCallback(
    (field: "title" | "description" | "station", value: string) => {
      const patch =
        field === "station" && value === ""
          ? { station: undefined }
          : { [field]: value };
      onWorldChange(updateRoom(world, roomId, patch));
    },
    [world, roomId, onWorldChange],
  );

  const handleDeleteExit = useCallback(
    (direction: string) => {
      setExitError(null);
      onWorldChange(deleteExit(world, roomId, direction));
    },
    [world, roomId, onWorldChange],
  );

  const updateExitDraftState = useCallback(
    (key: string, patch: Partial<ExitDraft>) => {
      setExitDrafts((current) => {
        const existing = current[key] ?? buildExitDraft(key);
        const next = { ...existing, ...patch };
        if (next.target.includes(":")) {
          next.bidirectional = false;
        }
        return { ...current, [key]: next };
      });
      setExitError(null);
    },
    [],
  );

  const handleApplyExit = useCallback(
    (currentDirection: string) => {
      const draft = exitDrafts[currentDirection];
      if (!draft) return;
      try {
        const resolvedTarget = resolveExitInput(
          draft.target,
          zoneId,
          world,
          loadedZones,
        );
        const next = updateExit(
          world,
          roomId,
          currentDirection,
          normalizeDir(draft.direction),
          resolvedTarget,
          draft.bidirectional,
        );
        onWorldChange(next);
        setExitError(null);
      } catch (error) {
        setExitError(error instanceof Error ? error.message : "Failed to update exit");
      }
    },
    [exitDrafts, loadedZones, onWorldChange, roomId, world, zoneId],
  );

  const handleCreateExit = useCallback(() => {
    try {
      const direction = normalizeDir(newExitDraft.direction);
      const target = resolveExitInput(
        newExitDraft.target,
        zoneId,
        world,
        loadedZones,
      );
      if (!direction) {
        throw new Error("Exit direction is required");
      }
      if (!target) {
        throw new Error("Exit target is required");
      }
      if (room.exits?.[direction]) {
        throw new Error(`Exit "${direction}" from "${roomId}" already exists`);
      }
      const next = addExit(
        world,
        roomId,
        direction,
        target,
        newExitDraft.bidirectional,
      );
      onWorldChange(next);
      setExitError(null);
      setExpandedDoor(null);
    } catch (error) {
      setExitError(error instanceof Error ? error.message : "Failed to create exit");
    }
  }, [loadedZones, newExitDraft, onWorldChange, roomId, world, zoneId]);

  const handleDeleteRoom = useCallback(() => {
    try {
      const next = deleteRoom(world, roomId);
      onWorldChange(next);
      onRoomDeleted();
    } catch {
      // Cannot delete start room — error is swallowed, button is hidden anyway
    }
  }, [world, roomId, onWorldChange, onRoomDeleted]);

  // ─── Entity creation ──────────────────────────────────────────
  const handleAddMob = useCallback(() => {
    const id = generateEntityId(world, "mobs");
    const next = addMob(world, id, { name: "New Mob", room: roomId });
    onWorldChange(next);
    onSelectEntity({ kind: "mob", id });
  }, [world, roomId, onWorldChange, onSelectEntity]);

  const handleAddItem = useCallback(() => {
    const id = generateEntityId(world, "items");
    const next = addItem(world, id, { displayName: "New Item", room: roomId });
    onWorldChange(next);
    onSelectEntity({ kind: "item", id });
  }, [world, roomId, onWorldChange, onSelectEntity]);

  const handleAddShop = useCallback(() => {
    const id = generateEntityId(world, "shops");
    const next = addShop(world, id, { name: "New Shop", room: roomId });
    onWorldChange(next);
    onSelectEntity({ kind: "shop", id });
  }, [world, roomId, onWorldChange, onSelectEntity]);

  const handleAddTrainer = useCallback(() => {
    const id = generateEntityId(world, "trainers");
    const next = addTrainer(world, id, { name: "New Trainer", class: "WARRIOR", room: roomId });
    onWorldChange(next);
    onSelectEntity({ kind: "trainer", id });
  }, [world, roomId, onWorldChange, onSelectEntity]);

  const handleAddGatheringNode = useCallback(() => {
    const id = generateEntityId(world, "gatheringNodes");
    const next = addGatheringNode(world, id, {
      displayName: "New Node",
      keyword: "node",
      skill: "MINING",
      yields: [],
      room: roomId,
    });
    onWorldChange(next);
    onSelectEntity({ kind: "gatheringNode", id });
  }, [world, roomId, onWorldChange, onSelectEntity]);

  const handleAddPuzzle = useCallback(
    (type: "riddle" | "sequence") => {
      const id = generateEntityId(world, "puzzles");
      const next = addPuzzle(world, id, defaultPuzzle(roomId, type));
      onWorldChange(next);
      onSelectEntity({ kind: "puzzle", id });
    },
    [world, roomId, onWorldChange, onSelectEntity],
  );

  return (
    <div className="relative flex min-h-0 min-w-0 w-[clamp(18rem,24vw,24rem)] flex-1 flex-col border-l border-border-default bg-bg-secondary max-[1100px]:max-h-[min(45vh,32rem)] max-[1100px]:w-full max-[1100px]:border-l-0 max-[1100px]:border-t">
      <img src={sidebarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]" />
      {/* Header */}
      <div className="relative z-10 shrink-0 border-b border-border-default px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <EditableField
              value={room.title}
              onCommit={(v) => handleFieldChange("title", v)}
              className="truncate text-sm font-semibold text-text-primary"
              label="room title"
            />
            <p className="mt-0.5 truncate text-xs text-text-muted" title={roomId}>
              {roomId}
            </p>
            {isStartRoom && (
              <span className="mt-1 inline-block rounded bg-accent/20 px-1.5 py-0.5 text-2xs font-medium text-accent">
                Start Room
              </span>
            )}
          </div>
          <button
            onClick={() => setShowYaml((v) => !v)}
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-2xs transition-colors ${
              showYaml
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:bg-bg-elevated hover:text-text-primary"
            }`}
            title="Toggle YAML preview"
          >
            YAML
          </button>
          <button
            onClick={onClose}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
            title="Close room panel"
            aria-label="Close room panel"
          >
            &times;
          </button>
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
      {showYaml ? (
        <YamlPreview data={{ [roomId]: room }} label={`room: ${roomId}`} />
      ) : (
      <>
      {/* Description */}
      <Section
        title="Description"
        actions={
          <EnhanceDescriptionButton
            entitySummary={`Room "${room.title}"${room.station ? `, crafting station: ${room.station}` : ""}`}
            currentDescription={room.description}
            onAccept={(v) => handleFieldChange("description", v)}
            vibe={vibe}
          />
        }
      >
        <EditableTextArea
          value={room.description}
          onCommit={(v) => handleFieldChange("description", v)}
          label="room description"
        />
      </Section>

      {/* Exits */}
      <Section
        title={`Exits (${exits.length})`}
        description="Edit room links here. Cross-zone targets use the `zone:room` format and stay one-way from this zone."
      >
        <div className="flex flex-col gap-2">
          {exitError && (
            <p className="rounded border border-status-error/30 bg-status-error/10 px-3 py-2 text-2xs text-status-error">
              {exitError}
            </p>
          )}

          {exits.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No exits</p>
          ) : (
            <ul className="flex flex-col gap-2 text-xs">
              {exits.map((exit) => {
                const isExpanded = expandedDoor === exit.direction;
                const draft = exitDrafts[exit.direction] ?? {
                  direction: exit.direction,
                  target: exit.target,
                  bidirectional: exit.isBidirectional,
                };
                const isCrossZone = draft.target.includes(":");
                const hasChanges =
                  normalizeDir(draft.direction) !== exit.direction
                  || draft.target.trim() !== exit.target
                  || (!!draft.bidirectional && !isCrossZone) !== exit.isBidirectional;

                return (
                  <li key={exit.direction} className="rounded-lg border border-border-muted bg-bg-tertiary/35 p-2">
                    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                      <label className="text-2xs text-text-muted">
                        Direction
                        <select
                          value={draft.direction}
                          onChange={(e) => updateExitDraftState(exit.direction, { direction: e.target.value })}
                          className="ornate-input mt-1 w-full rounded px-2 py-1 text-xs text-text-primary"
                        >
                          {EXIT_DIRECTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="min-w-0 text-2xs text-text-muted">
                        Target
                        <input
                          value={draft.target}
                          onChange={(e) => updateExitDraftState(exit.direction, { target: e.target.value })}
                          placeholder="room_id or zone:room_id"
                          list={`exit-target-suggestions-${roomId}`}
                          className={`ornate-input mt-1 w-full rounded px-2 py-1 text-xs ${isCrossZone ? "text-accent" : "text-text-primary"}`}
                        />
                      </label>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className={`flex items-center gap-1.5 text-2xs ${isCrossZone ? "text-text-muted/50" : "text-text-secondary"}`}>
                        <input
                          type="checkbox"
                          checked={!isCrossZone && draft.bidirectional}
                          disabled={isCrossZone}
                          onChange={(e) => updateExitDraftState(exit.direction, { bidirectional: e.target.checked })}
                          className="accent-accent"
                        />
                        Reverse link
                      </label>

                      {isCrossZone && (
                        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-2xs text-accent">
                          Cross-zone
                        </span>
                      )}

                      <button
                        onClick={() => handleApplyExit(exit.direction)}
                        disabled={!hasChanges}
                        className="rounded border border-accent/30 px-2 py-1 text-2xs text-accent transition-colors enabled:hover:bg-accent/10 disabled:opacity-40"
                      >
                        Apply
                      </button>

                      <button
                        onClick={() => setExpandedDoor(isExpanded ? null : exit.direction)}
                        className={`rounded px-2 py-1 text-2xs transition-colors ${
                          exit.hasDoor
                            ? "text-status-warning hover:bg-bg-elevated"
                            : "text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                        }`}
                        title={exit.hasDoor ? "Edit door" : "Add door"}
                        aria-label={exit.hasDoor ? "Edit door" : "Add door"}
                        aria-expanded={isExpanded}
                      >
                        {exit.hasDoor ? (exit.isLocked ? "\uD83D\uDD12 Door" : "\uD83D\uDEAA Door") : "+ Door"}
                      </button>

                      <button
                        onClick={() => handleDeleteExit(exit.direction)}
                        className="ml-auto shrink-0 text-text-muted transition-colors hover:text-status-danger"
                        title="Delete exit"
                        aria-label="Delete exit"
                      >
                        &times;
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-2">
                        <ExitDoorEditor
                          world={world}
                          roomId={roomId}
                          direction={exit.direction}
                          door={exit.door}
                          onWorldChange={onWorldChange}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="rounded-xl border border-accent/25 bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.12),rgba(var(--accent-rgb),0.04))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                New
              </span>
              <p className="text-2xs uppercase tracking-widest text-text-secondary">Create Exit</p>
            </div>
            <p className="mt-1 text-2xs leading-relaxed text-text-muted">
              Start with a direction, then target a local room or type a loaded foreign zone like <span className="font-mono text-accent">otherzone:</span>.
            </p>
            <div className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
              <label className="text-2xs text-text-muted">
                Direction
                <select
                  value={newExitDraft.direction}
                  onChange={(e) => {
                    setNewExitDraft((current) => ({ ...current, direction: e.target.value }));
                    setExitError(null);
                  }}
                  className="ornate-input mt-1 w-full rounded px-2 py-1 text-xs text-text-primary"
                >
                  {EXIT_DIRECTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0 text-2xs text-text-muted">
                Target
                <input
                  value={newExitDraft.target}
                  onChange={(e) => {
                    const target = e.target.value;
                    setNewExitDraft((current) => ({
                      ...current,
                      target,
                      bidirectional: target.includes(":") ? false : current.bidirectional,
                    }));
                    setExitError(null);
                  }}
                  placeholder="room_id or zone:room_id"
                  list={`exit-target-suggestions-${roomId}`}
                  className={`ornate-input mt-1 w-full rounded px-2 py-1 text-xs ${newExitDraft.target.includes(":") ? "text-accent" : "text-text-primary"}`}
                />
              </label>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className={`flex items-center gap-1.5 text-2xs ${newExitDraft.target.includes(":") ? "text-text-muted/50" : "text-text-secondary"}`}>
                <input
                  type="checkbox"
                  checked={!newExitDraft.target.includes(":") && newExitDraft.bidirectional}
                  disabled={newExitDraft.target.includes(":")}
                  onChange={(e) => {
                    setNewExitDraft((current) => ({ ...current, bidirectional: e.target.checked }));
                    setExitError(null);
                  }}
                  className="accent-accent"
                />
                Reverse link
              </label>

              {newExitDraft.target.includes(":") && (
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-2xs text-accent">
                  Cross-zone
                </span>
              )}

              <button
                onClick={handleCreateExit}
                disabled={!newExitDraft.direction || !newExitDraft.target.trim()}
                className="rounded border border-accent/30 px-2 py-1 text-2xs text-accent transition-colors hover:bg-accent/10"
              >
                Create
              </button>
            </div>
          </div>

          <datalist id={`exit-target-suggestions-${roomId}`}>
            {exitSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
      </Section>

      {/* Room features */}
      <Section
        title={`Features (${Object.keys(room.features ?? {}).length})`}
        description="Containers, levers, and signs players can interact with in this room. Sequence puzzles below can reference these same feature keys."
        defaultExpanded={Object.keys(room.features ?? {}).length > 0}
      >
        <RoomFeaturesEditor
          world={world}
          roomId={roomId}
          onWorldChange={onWorldChange}
        />
      </Section>

      {/* Room roles */}
      <Section
        title="Room Roles"
        description="Capabilities owned directly by the room itself rather than separate placed entities."
        defaultExpanded={!!room.station || !!room.bank || !!room.tavern}
      >
        <div className="flex flex-col gap-2">
          <FieldRow
            label="Station"
            hint="Choose a configured crafting station type. This is a room capability, not a separate NPC."
          >
            <SelectInput
              value={room.station ?? ""}
              options={stationOptions}
              onCommit={(v) => handleFieldChange("station", v)}
              placeholder="No station"
              allowEmpty
            />
          </FieldRow>
          <FieldRow
            label="Bank"
            hint="Enables deposit and withdraw commands in this room. No separate bank NPC is required by this schema."
          >
            <CheckboxInput
              checked={room.bank ?? false}
              onCommit={(value) => onWorldChange(updateRoom(world, roomId, { bank: value || undefined }))}
              label="Room functions as a bank"
            />
          </FieldRow>
          <FieldRow
            label="Tavern"
            hint="Marks this room as a tavern / rest point for tavern-specific commands and systems."
          >
            <CheckboxInput
              checked={room.tavern ?? false}
              onCommit={(value) => onWorldChange(updateRoom(world, roomId, { tavern: value || undefined }))}
              label="Room functions as a tavern"
            />
          </FieldRow>
        </div>
      </Section>

      {/* Mobs */}
      <Section
        title={`Mobs (${mobs.length})`}
        defaultExpanded={false}
        actions={<IconButton onClick={handleAddMob} title="Add mob">+</IconButton>}
      >
        {mobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No mobs in this room</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {mobs.map(([id, mob]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "mob", id })}
                  className="flex w-full min-w-0 items-baseline gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="truncate font-medium text-text-primary" title={mob.name}>
                    {mob.name}
                  </span>
                  <span className="truncate text-text-muted">
                    {mob.tier ?? "standard"} L{mob.level ?? 1}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Items */}
      <Section
        title={`Items (${items.length})`}
        defaultExpanded={false}
        actions={<IconButton onClick={handleAddItem} title="Add item">+</IconButton>}
      >
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No items in this room</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map(([id, item]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "item", id })}
                  className="flex w-full min-w-0 items-baseline gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="truncate font-medium text-text-primary" title={item.displayName}>
                    {item.displayName}
                  </span>
                  {item.slot && (
                    <span className="truncate text-text-muted">[{item.slot}]</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Services */}
      <Section
        title={`Services (${shops.length + trainers.length + gatheringNodes.length})`}
        defaultExpanded={false}
        description="Room-scoped services and interactables that players use here."
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={handleAddShop}
              className="rounded border border-border-default px-2 py-1 text-2xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
              title="Add shop"
            >
              + Shop
            </button>
            <button
              onClick={handleAddTrainer}
              className="rounded border border-border-default px-2 py-1 text-2xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
              title="Add trainer"
            >
              + Trainer
            </button>
            <button
              onClick={handleAddGatheringNode}
              className="rounded border border-border-default px-2 py-1 text-2xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
              title="Add gathering node"
            >
              + Node
            </button>
          </div>
        }
      >
        {shops.length + trainers.length + gatheringNodes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No service entities in this room</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xs uppercase tracking-widest text-text-muted">Shops</span>
                <span className="text-2xs text-text-muted">{shops.length}</span>
              </div>
              {shops.length === 0 ? (
                <p className="text-xs italic text-text-muted">No shops in this room</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {shops.map(([id, shop]) => (
                    <li key={id}>
                      <button
                        onClick={() => onSelectEntity({ kind: "shop", id })}
                        className="flex w-full min-w-0 items-baseline gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                      >
                        <span className="truncate font-medium text-text-primary" title={shop.name}>
                          {shop.name}
                        </span>
                        <span className="truncate text-text-muted">
                          ({shop.items?.length ?? 0} items)
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xs uppercase tracking-widest text-text-muted">Training</span>
                <span className="text-2xs text-text-muted">{trainers.length}</span>
              </div>
              {trainers.length === 0 ? (
                <p className="text-xs italic text-text-muted">No training service in this room</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {trainers.map(([id, trainer]) => (
                    <li key={id}>
                      <button
                        onClick={() => onSelectEntity({ kind: "trainer", id })}
                        className="flex w-full min-w-0 items-baseline gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                      >
                        <span className="truncate font-medium text-text-primary" title={trainer.name}>
                          {trainer.name}
                        </span>
                        <span className="truncate text-text-muted">
                          [{getTrainerClasses(trainer).join(", ") || "?"}]
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xs uppercase tracking-widest text-text-muted">Gathering</span>
                <span className="text-2xs text-text-muted">{gatheringNodes.length}</span>
              </div>
              {gatheringNodes.length === 0 ? (
                <p className="text-xs italic text-text-muted">No gathering nodes in this room</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {gatheringNodes.map(([id, node]) => (
                    <li key={id}>
                      <button
                        onClick={() => onSelectEntity({ kind: "gatheringNode", id })}
                        className="flex w-full min-w-0 items-baseline gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                      >
                        <span className="truncate font-medium text-text-primary" title={node.displayName}>
                          {node.displayName}
                        </span>
                        <span className="truncate text-text-muted">{node.skill}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Quests */}
      <Section title={`Quests (${quests.length})`} defaultExpanded={false}>
        {quests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No quests from this room</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {quests.map(([id, quest]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "quest", id })}
                  className="w-full min-w-0 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="block truncate font-medium text-text-primary" title={quest.name}>
                    {quest.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Puzzles */}
      <Section
        title={`Puzzles (${puzzles.length})`}
        description="Sequence puzzles usually target room features like levers and containers defined above."
        defaultExpanded={puzzles.length > 0}
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAddPuzzle("riddle")}
              className="rounded border border-border-default px-2 py-1 text-2xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
              title="Add riddle puzzle"
            >
              + Riddle
            </button>
            <button
              onClick={() => handleAddPuzzle("sequence")}
              className="rounded border border-border-default px-2 py-1 text-2xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
              title="Add sequence puzzle"
            >
              + Sequence
            </button>
          </div>
        }
      >
        {puzzles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No puzzles in this room</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {puzzles.map(([id, puzzle]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "puzzle", id })}
                  className="flex w-full min-w-0 items-baseline gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="truncate font-medium text-text-primary" title={id}>
                    {id}
                  </span>
                  <span className="truncate text-text-muted">[{puzzle.type}]</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Zone Vibe */}
      <Section title="Zone Vibe" defaultExpanded={false}>
        <ZoneVibePanel zoneId={zoneId} world={world} onWorldChange={onWorldChange} />
      </Section>

      {/* Media */}
      <Section title="Media" defaultExpanded={false}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 text-xs">
            <span className="w-12 shrink-0 text-text-muted">Image</span>
            <span className="truncate text-text-secondary">{room.image || "none"}</span>
          </div>
          <EntityArtGenerator
            getPrompt={(style) => roomPrompt(roomId, room, style)}
            entityContext={roomContext(roomId, room)}
            currentImage={room.image}
            onAccept={(filePath) => onWorldChange(updateRoom(world, roomId, { image: filePath }))}
            assetType="background"
            context={{ zone: zoneId, entity_type: "room", entity_id: roomId }}
            vibe={vibe}
            surface="worldbuilding"
          />
          <FieldRow label="Video">
            <TextInput
              value={room.video ?? ""}
              onCommit={(v) => onWorldChange(updateRoom(world, roomId, { video: v || undefined }))}
              placeholder="None"
            />
          </FieldRow>
          <MediaPicker
            value={room.video}
            onChange={(v) => onWorldChange(updateRoom(world, roomId, { video: v }))}
            mediaType="video"
            assetType="video"
            context={{ zone: zoneId, entity_type: "room", entity_id: roomId }}
            variantGroup={`room-media:${zoneId}:${roomId}:video`}
            isActive
          />
          <VideoGenerator
            imagePath={room.image && assetsDir ? `${assetsDir}\\images\\${room.image}` : undefined}
            entityName={room.title}
            entityDescription={room.description}
            videoType="room_cinematic"
            assetType="video"
            context={{ zone: zoneId, entity_type: "room", entity_id: roomId }}
            variantGroup={`room-media:${zoneId}:${roomId}:video`}
            markActive
            onAccept={(fileName) => {
              onWorldChange(updateRoom(world, roomId, { video: fileName }));
            }}
          />
        </div>
      </Section>

      {/* Audio */}
      <Section title="Audio" defaultExpanded={false}>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Music">
            <TextInput
              value={room.music ?? ""}
              onCommit={(v) => onWorldChange(updateRoom(world, roomId, { music: v || undefined }))}
              placeholder="None"
            />
          </FieldRow>
          <MediaPicker
            value={room.music}
            onChange={(v) => onWorldChange(updateRoom(world, roomId, { music: v }))}
            mediaType="audio"
            assetType="music"
            context={{ zone: zoneId, entity_type: "room", entity_id: roomId }}
            variantGroup={`room-media:${zoneId}:${roomId}:music`}
            isActive
          />
          <MusicGenerator
            roomTitle={room.title}
            roomDescription={room.description}
            vibe={vibe}
            currentAudio={room.music}
            trackType="music"
            assetType="music"
            context={{ zone: zoneId, entity_type: "room", entity_id: roomId }}
            variantGroup={`room-media:${zoneId}:${roomId}:music`}
            markActive
            onAccept={(fileName) => {
              onWorldChange(updateRoom(world, roomId, { music: fileName }));
            }}
          />
          <FieldRow label="Ambient">
            <TextInput
              value={room.ambient ?? ""}
              onCommit={(v) => onWorldChange(updateRoom(world, roomId, { ambient: v || undefined }))}
              placeholder="None"
            />
          </FieldRow>
          <MediaPicker
            value={room.ambient}
            onChange={(v) => onWorldChange(updateRoom(world, roomId, { ambient: v }))}
            mediaType="audio"
            assetType="ambient"
            context={{ zone: zoneId, entity_type: "room", entity_id: roomId }}
            variantGroup={`room-media:${zoneId}:${roomId}:ambient`}
            isActive
          />
          <MusicGenerator
            roomTitle={room.title}
            roomDescription={room.description}
            vibe={vibe}
            currentAudio={room.ambient}
            trackType="ambient"
            assetType="ambient"
            context={{ zone: zoneId, entity_type: "room", entity_id: roomId }}
            variantGroup={`room-media:${zoneId}:${roomId}:ambient`}
            markActive
            onAccept={(fileName) => {
              onWorldChange(updateRoom(world, roomId, { ambient: fileName }));
            }}
          />
          <FieldRow label="Audio">
            <TextInput
              value={room.audio ?? ""}
              onCommit={(v) => onWorldChange(updateRoom(world, roomId, { audio: v || undefined }))}
              placeholder="None"
            />
          </FieldRow>
          <MediaPicker
            value={room.audio}
            onChange={(v) => onWorldChange(updateRoom(world, roomId, { audio: v }))}
            mediaType="audio"
            assetType="audio"
            context={{ zone: zoneId, entity_type: "room", entity_id: roomId }}
            variantGroup={`room-media:${zoneId}:${roomId}:audio`}
            isActive
          />
        </div>
      </Section>

      {/* Delete Room */}
      {!isStartRoom && (
        <div className="px-4 py-3">
          <button
            onClick={handleDeleteRoom}
            className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
          >
            Delete Room
          </button>
        </div>
      )}
      </>
      )}
      </div>
    </div>
  );
}
