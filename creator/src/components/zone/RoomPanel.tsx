import { useCallback, useMemo, useState } from "react";
import type { WorldFile, ExitValue, DoorFile } from "@/types/world";
import {
  updateRoom,
  deleteRoom,
  deleteExit,
  addMob,
  addItem,
  addShop,
  addTrainer,
  addGatheringNode,
  addPuzzle,
  defaultPuzzle,
  generateEntityId,
} from "@/lib/zoneEdits";
import { ExitDoorEditor } from "./ExitDoorEditor";
import { RoomFeaturesEditor } from "./RoomFeaturesEditor";
import { EditableField, EditableTextArea, Section, IconButton, FieldRow, TextInput } from "@/components/ui/FormWidgets";
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
  onRoomDeleted: () => void;
  onSelectEntity: (selection: EntitySelection) => void;
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

export function RoomPanel({
  zoneId,
  roomId,
  world,
  onWorldChange,
  onRoomDeleted,
  onSelectEntity,
}: RoomPanelProps) {
  const [showYaml, setShowYaml] = useState(false);
  const [expandedDoor, setExpandedDoor] = useState<string | null>(null);
  const vibe = useVibeStore((s) => s.getVibe(zoneId));
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const room = world.rooms[roomId];
  if (!room) return null;

  const isStartRoom = roomId === world.startRoom;

  const exits = useMemo(
    () =>
      Object.entries(room.exits ?? {}).map(([dir, val]) => ({
        direction: dir,
        ...resolveExitTarget(val),
      })),
    [room.exits],
  );

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
      onWorldChange(deleteExit(world, roomId, direction));
    },
    [world, roomId, onWorldChange],
  );

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
      <Section title="Exits">
        {exits.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No exits</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {exits.map((exit) => {
              const isExpanded = expandedDoor === exit.direction;
              return (
                <li key={exit.direction} className="group rounded border border-transparent hover:border-border-muted">
                  <div className="flex items-center gap-2 px-1 py-1">
                    <span className="w-6 shrink-0 font-medium text-text-primary">
                      {exit.direction.toUpperCase()}
                    </span>
                    <span
                      className={`min-w-0 flex-1 break-all text-text-secondary ${exit.target.includes(":") ? "text-accent" : ""}`}
                      title={exit.target}
                    >
                      {exit.target}
                    </span>
                    <button
                      onClick={() => setExpandedDoor(isExpanded ? null : exit.direction)}
                      className={`shrink-0 rounded px-1 py-0.5 text-2xs transition-colors ${
                        exit.hasDoor
                          ? "text-status-warning hover:bg-bg-elevated"
                          : "text-text-muted opacity-0 hover:bg-bg-elevated hover:text-text-primary group-hover:opacity-100 focus-visible:opacity-100"
                      }`}
                      title={exit.hasDoor ? "Edit door" : "Add door"}
                      aria-label={exit.hasDoor ? "Edit door" : "Add door"}
                      aria-expanded={isExpanded}
                    >
                      {exit.hasDoor ? (exit.isLocked ? "\uD83D\uDD12 Door" : "\uD83D\uDEAA Door") : "+ Door"}
                    </button>
                    <button
                      onClick={() => handleDeleteExit(exit.direction)}
                      className="shrink-0 text-text-muted opacity-0 transition-colors hover:text-status-danger group-hover:opacity-100 focus-visible:opacity-100"
                      title="Delete exit"
                      aria-label="Delete exit"
                    >
                      &times;
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-1 pb-1">
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
      </Section>

      {/* Room features */}
      <Section
        title={`Features (${Object.keys(room.features ?? {}).length})`}
        description="Containers, levers, and signs players can interact with in this room."
        defaultExpanded={Object.keys(room.features ?? {}).length > 0}
      >
        <RoomFeaturesEditor
          world={world}
          roomId={roomId}
          onWorldChange={onWorldChange}
        />
      </Section>

      {/* Station */}
      <Section title="Crafting Station" defaultExpanded={false}>
        <EditableField
          value={room.station ?? ""}
          onCommit={(v) => handleFieldChange("station", v)}
          placeholder="None"
          className="text-xs text-status-info"
          label="crafting station"
        />
      </Section>

      {/* Bank */}
      <Section title="Bank" defaultExpanded={false}>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={room.bank ?? false}
            onChange={(e) => onWorldChange(updateRoom(world, roomId, { bank: e.target.checked || undefined }))}
            className="accent-accent"
          />
          This room has a bank NPC (enables deposit/withdraw commands)
        </label>
      </Section>

      {/* Tavern */}
      <Section title="Tavern" defaultExpanded={false}>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={room.tavern ?? false}
            onChange={(e) => onWorldChange(updateRoom(world, roomId, { tavern: e.target.checked || undefined }))}
            className="accent-accent"
          />
          Tavern (enables gambling)
        </label>
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

      {/* Shops */}
      <Section
        title={`Shops (${shops.length})`}
        defaultExpanded={false}
        actions={<IconButton onClick={handleAddShop} title="Add shop">+</IconButton>}
      >
        {shops.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No shops in this room</p>
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
      </Section>

      {/* Trainers */}
      <Section
        title={`Trainers (${trainers.length})`}
        defaultExpanded={false}
        actions={<IconButton onClick={handleAddTrainer} title="Add trainer">+</IconButton>}
      >
        {trainers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No trainers in this room</p>
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
      </Section>

      {/* Gathering Nodes */}
      <Section
        title={`Gathering (${gatheringNodes.length})`}
        defaultExpanded={false}
        actions={
          <IconButton onClick={handleAddGatheringNode} title="Add gathering node">
            +
          </IconButton>
        }
      >
        {gatheringNodes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">No gathering nodes</p>
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
        defaultExpanded={puzzles.length > 0}
        actions={
          <div className="flex items-center gap-0.5">
            <IconButton onClick={() => handleAddPuzzle("riddle")} title="Add riddle puzzle">
              R
            </IconButton>
            <IconButton onClick={() => handleAddPuzzle("sequence")} title="Add sequence puzzle">
              S
            </IconButton>
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
