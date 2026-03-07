import { useCallback, useState } from "react";
import type { WorldFile, ExitValue } from "@/types/world";
import {
  updateRoom,
  deleteRoom,
  deleteExit,
  addMob,
  addItem,
  addShop,
  addGatheringNode,
  generateEntityId,
} from "@/lib/zoneEdits";
import { EditableField, EditableTextArea, Section, IconButton, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { YamlPreview } from "@/components/ui/YamlPreview";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { roomPrompt, roomContext } from "@/lib/entityPrompts";
import { EnhanceDescriptionButton } from "@/components/editors/EditorShared";
import { useVibeStore } from "@/stores/vibeStore";
import { ZoneVibePanel } from "./ZoneVibePanel";

export type EntityKind = "mob" | "item" | "shop" | "quest" | "gatheringNode" | "recipe";

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
  hasDoor: boolean;
  isLocked: boolean;
  keyItem?: string;
} {
  if (typeof exit === "string") {
    return { target: exit, hasDoor: false, isLocked: false };
  }
  return {
    target: exit.to,
    hasDoor: !!exit.door,
    isLocked: !!exit.door?.locked,
    keyItem: exit.door?.key,
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
  const room = world.rooms[roomId];
  if (!room) return null;

  const isStartRoom = roomId === world.startRoom;

  const exits = Object.entries(room.exits ?? {}).map(([dir, val]) => ({
    direction: dir,
    ...resolveExitTarget(val),
  }));

  // Find entities in this room
  const mobs = Object.entries(world.mobs ?? {}).filter(
    ([, m]) => m.room === roomId,
  );
  const items = Object.entries(world.items ?? {}).filter(
    ([, i]) => i.room === roomId,
  );
  const shops = Object.entries(world.shops ?? {}).filter(
    ([, s]) => s.room === roomId,
  );
  const gatheringNodes = Object.entries(world.gatheringNodes ?? {}).filter(
    ([, g]) => g.room === roomId,
  );
  const quests = Object.entries(world.quests ?? {}).filter(([, q]) => {
    const giverMob = Object.entries(world.mobs ?? {}).find(
      ([mobId]) => mobId === q.giver || `${zoneId}:${mobId}` === q.giver,
    );
    return giverMob && giverMob[1].room === roomId;
  });

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

  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col border-l border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="shrink-0 border-b border-border-default px-4 py-3">
        <div className="flex items-start justify-between">
          <div>
            <EditableField
              value={room.title}
              onCommit={(v) => handleFieldChange("title", v)}
              className="text-sm font-semibold text-text-primary"
            />
            <p className="mt-0.5 text-xs text-text-muted">{roomId}</p>
            {isStartRoom && (
              <span className="mt-1 inline-block rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                Start Room
              </span>
            )}
          </div>
          <button
            onClick={() => setShowYaml((v) => !v)}
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
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

      <div className="min-h-0 flex-1 overflow-y-auto">
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
            vibe={useVibeStore.getState().getVibe(zoneId)}
          />
        }
      >
        <EditableTextArea
          value={room.description}
          onCommit={(v) => handleFieldChange("description", v)}
        />
      </Section>

      {/* Exits */}
      <Section title="Exits">
        {exits.length === 0 ? (
          <p className="text-xs text-text-muted">No exits</p>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {exits.map((exit) => (
                <tr key={exit.direction} className="group border-b border-border-muted last:border-0">
                  <td className="py-1 pr-2 font-medium text-text-primary">
                    {exit.direction.toUpperCase()}
                  </td>
                  <td className="py-1 text-text-secondary">
                    <span className={exit.target.includes(":") ? "text-accent" : ""}>
                      {exit.target}
                    </span>
                    {exit.hasDoor && (
                      <span className="ml-1 text-status-warning">
                        {exit.isLocked ? "\uD83D\uDD12" : "\uD83D\uDEAA"}
                      </span>
                    )}
                  </td>
                  <td className="w-6 py-1 text-right">
                    <button
                      onClick={() => handleDeleteExit(exit.direction)}
                      className="invisible text-text-muted transition-colors hover:text-status-danger group-hover:visible"
                      title="Delete exit"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Station */}
      <Section title="Crafting Station">
        <EditableField
          value={room.station ?? ""}
          onCommit={(v) => handleFieldChange("station", v)}
          placeholder="none"
          className="text-xs text-status-info"
        />
      </Section>

      {/* Mobs */}
      <Section
        title={`Mobs (${mobs.length})`}
        actions={<IconButton onClick={handleAddMob} title="Add mob">+</IconButton>}
      >
        {mobs.length === 0 ? (
          <p className="text-xs text-text-muted">No mobs in this room</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {mobs.map(([id, mob]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "mob", id })}
                  className="w-full rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="font-medium text-text-primary">{mob.name}</span>
                  <span className="ml-1 text-text-muted">
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
        actions={<IconButton onClick={handleAddItem} title="Add item">+</IconButton>}
      >
        {items.length === 0 ? (
          <p className="text-xs text-text-muted">No items in this room</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map(([id, item]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "item", id })}
                  className="w-full rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="font-medium text-text-primary">
                    {item.displayName}
                  </span>
                  {item.slot && (
                    <span className="ml-1 text-text-muted">[{item.slot}]</span>
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
        actions={<IconButton onClick={handleAddShop} title="Add shop">+</IconButton>}
      >
        {shops.length === 0 ? (
          <p className="text-xs text-text-muted">No shops in this room</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {shops.map(([id, shop]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "shop", id })}
                  className="w-full rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="font-medium text-text-primary">{shop.name}</span>
                  <span className="ml-1 text-text-muted">
                    ({shop.items?.length ?? 0} items)
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
        actions={
          <IconButton onClick={handleAddGatheringNode} title="Add gathering node">
            +
          </IconButton>
        }
      >
        {gatheringNodes.length === 0 ? (
          <p className="text-xs text-text-muted">No gathering nodes</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {gatheringNodes.map(([id, node]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "gatheringNode", id })}
                  className="w-full rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="font-medium text-text-primary">
                    {node.displayName}
                  </span>
                  <span className="ml-1 text-text-muted">{node.skill}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Quests */}
      <Section title={`Quests (${quests.length})`}>
        {quests.length === 0 ? (
          <p className="text-xs text-text-muted">No quests from this room</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {quests.map(([id, quest]) => (
              <li key={id}>
                <button
                  onClick={() => onSelectEntity({ kind: "quest", id })}
                  className="w-full rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-bg-tertiary"
                >
                  <span className="font-medium text-text-primary">{quest.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Zone Vibe */}
      <Section title="Zone Vibe">
        <ZoneVibePanel zoneId={zoneId} world={world} />
      </Section>

      {/* Media */}
      <Section title="Media">
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
            vibe={useVibeStore.getState().getVibe(zoneId)}
          />
          <FieldRow label="Video">
            <TextInput
              value={room.video ?? ""}
              onCommit={(v) => onWorldChange(updateRoom(world, roomId, { video: v || undefined }))}
              placeholder="none"
            />
          </FieldRow>
          <MediaPicker
            value={room.video}
            onChange={(v) => onWorldChange(updateRoom(world, roomId, { video: v }))}
            mediaType="video"
            assetType="video"
          />
        </div>
      </Section>

      {/* Audio */}
      <Section title="Audio">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Music">
            <TextInput
              value={room.music ?? ""}
              onCommit={(v) => onWorldChange(updateRoom(world, roomId, { music: v || undefined }))}
              placeholder="none"
            />
          </FieldRow>
          <MediaPicker
            value={room.music}
            onChange={(v) => onWorldChange(updateRoom(world, roomId, { music: v }))}
            mediaType="audio"
            assetType="music"
          />
          <FieldRow label="Ambient">
            <TextInput
              value={room.ambient ?? ""}
              onCommit={(v) => onWorldChange(updateRoom(world, roomId, { ambient: v || undefined }))}
              placeholder="none"
            />
          </FieldRow>
          <MediaPicker
            value={room.ambient}
            onChange={(v) => onWorldChange(updateRoom(world, roomId, { ambient: v }))}
            mediaType="audio"
            assetType="ambient"
          />
          <FieldRow label="Audio">
            <TextInput
              value={room.audio ?? ""}
              onCommit={(v) => onWorldChange(updateRoom(world, roomId, { audio: v || undefined }))}
              placeholder="none"
            />
          </FieldRow>
          <MediaPicker
            value={room.audio}
            onChange={(v) => onWorldChange(updateRoom(world, roomId, { audio: v }))}
            mediaType="audio"
            assetType="audio"
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

