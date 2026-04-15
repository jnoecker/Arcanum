import { useState, useCallback, useMemo } from "react";
import { useZoneStore } from "@/stores/zoneStore";
import { useStoryStore } from "@/stores/storyStore";
import { getNextSlot } from "@/lib/sceneLayout";
import { EntityPickerTab } from "./EntityPickerTab";
import { AssetPickerModal } from "@/components/ui/AssetPickerModal";
import type { Scene, SceneEntity, EntitySlot } from "@/types/story";

// ─── Types ────────────────────────────────────────────────────────

interface EntityPickerProps {
  zoneId: string;
  scene: Scene;
  storyId: string;
}

// ─── Tab type ─────────────────────────────────────────────────────

type PickerTab = "rooms" | "mobs" | "items";

const TAB_LABELS: { key: PickerTab; label: string }[] = [
  { key: "rooms", label: "Rooms" },
  { key: "mobs", label: "Mobs" },
  { key: "items", label: "Items" },
];

// ─── EntityPicker ─────────────────────────────────────────────────

export function EntityPicker({ zoneId, scene, storyId }: EntityPickerProps) {
  const [activeTab, setActiveTab] = useState<PickerTab>("rooms");
  const [collapsed, setCollapsed] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState<PickerTab | null>(null);

  const zoneState = useZoneStore((s) => s.zones.get(zoneId));
  const updateScene = useStoryStore((s) => s.updateScene);

  // ─── Entity list derivation ───────────────────────────────────

  const rooms = useMemo(
    () =>
      zoneState
        ? Object.entries(zoneState.data.rooms).map(([id, r]) => ({
            id,
            name: r.title,
            image: r.image,
          }))
        : [],
    [zoneState],
  );

  const mobs = useMemo(
    () =>
      zoneState?.data.mobs
        ? Object.entries(zoneState.data.mobs).map(([id, m]) => ({
            id,
            name: m.name,
            image: m.image,
          }))
        : [],
    [zoneState],
  );

  const items = useMemo(
    () =>
      zoneState?.data.items
        ? Object.entries(zoneState.data.items).map(([id, i]) => ({
            id,
            name: i.displayName,
            image: i.image,
          }))
        : [],
    [zoneState],
  );

  // ─── Click handlers ───────────────────────────────────────────

  const handleRoomClick = useCallback(
    (roomId: string) => {
      updateScene(storyId, scene.id, { roomId });
    },
    [storyId, scene.id, updateScene],
  );

  const handleEntityClick = useCallback(
    (entityId: string, entityType: "mob" | "item") => {
      const occupiedSlots = (scene.entities ?? [])
        .filter((e) => e.slot)
        .map((e) => e.slot as EntitySlot);
      const slot = getNextSlot(occupiedSlots);
      const newEntity: SceneEntity = {
        id: `entity_${Math.random().toString(36).substring(2, 8)}`,
        entityType,
        entityId,
        slot,
      };
      updateScene(storyId, scene.id, {
        entities: [...(scene.entities ?? []), newEntity],
      });
    },
    [storyId, scene.id, scene.entities, updateScene],
  );

  // ─── Custom image handler ───────────────────────────────────

  const handleCustomImageSelect = useCallback(
    (fileName: string, tab: PickerTab) => {
      if (tab === "rooms") {
        updateScene(storyId, scene.id, { backgroundOverride: fileName });
      } else {
        const entityType = tab === "mobs" ? "mob" as const : "item" as const;
        const occupiedSlots = (scene.entities ?? [])
          .filter((e) => e.slot)
          .map((e) => e.slot as EntitySlot);
        const slot = getNextSlot(occupiedSlots);
        const baseName = fileName.replace(/\.[^.]+$/, "").replace(/^[a-f0-9]{64}_?/, "");
        const newEntity: SceneEntity = {
          id: `entity_${Math.random().toString(36).substring(2, 8)}`,
          entityType,
          entityId: `custom_${Date.now()}`,
          slot,
          imageOverride: fileName,
          nameOverride: baseName || "Custom",
        };
        updateScene(storyId, scene.id, {
          entities: [...(scene.entities ?? []), newEntity],
        });
      }
      setShowAssetPicker(null);
    },
    [storyId, scene.id, scene.entities, updateScene],
  );

  // ─── Zone not loaded fallback ─────────────────────────────────

  if (!zoneState) {
    return (
      <div className="w-[clamp(16rem,20vw,20rem)] shrink-0 bg-bg-secondary border-l border-border-default flex items-center justify-center">
        <p className="text-xs text-text-muted px-4 text-center">
          Load zone to browse entities
        </p>
      </div>
    );
  }

  // ─── Collapsed state ──────────────────────────────────────────

  if (collapsed) {
    return (
      <div className="w-8 shrink-0 bg-bg-secondary border-l border-border-default flex flex-col items-center">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-controls="entity-picker-content"
          className="py-4 px-1 text-text-muted hover:text-text-primary transition-colors"
          title="Expand entity picker"
        >
          <span
            className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted"
            style={{ writingMode: "vertical-rl" }}
          >
            Entities
          </span>
        </button>
      </div>
    );
  }

  // ─── Expanded state ───────────────────────────────────────────

  const tabEntities =
    activeTab === "rooms"
      ? rooms
      : activeTab === "mobs"
        ? mobs
        : items;

  return (
    <div
      className="w-[clamp(16rem,20vw,20rem)] shrink-0 bg-bg-secondary border-l border-border-default flex flex-col overflow-hidden"
      id="entity-picker-content"
    >
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-muted">
        <span className="font-display text-xs uppercase tracking-[0.18em] text-text-secondary">
          Entities
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-expanded={true}
          aria-controls="entity-picker-content"
          className="text-text-muted hover:text-text-primary transition-colors p-1"
          title="Collapse entity picker"
        >
          {/* Chevron right (collapse) */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M5 3l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div role="tablist" className="flex border-b border-border-muted">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2 font-display text-xs uppercase tracking-[0.18em] transition-colors ${
              activeTab === key
                ? "text-accent border-b-2 border-accent"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" className="flex-1 min-h-0 flex flex-col p-2">
        <EntityPickerTab
          entities={tabEntities}
          entityType={activeTab === "rooms" ? "room" : activeTab === "mobs" ? "mob" : "item"}
          activeEntityId={activeTab === "rooms" ? scene.roomId : undefined}
          onEntityClick={
            activeTab === "rooms"
              ? handleRoomClick
              : (entityId: string) =>
                  handleEntityClick(
                    entityId,
                    activeTab === "mobs" ? "mob" : "item",
                  )
          }
        />

        {/* + Custom button */}
        <button
          type="button"
          onClick={() => setShowAssetPicker(activeTab)}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-muted py-2 text-xs text-text-muted transition-colors hover:border-accent/40 hover:text-accent"
        >
          <span className="text-sm leading-none">+</span>
          Custom
        </button>

        {/* Clear custom background (rooms tab only) */}
        {activeTab === "rooms" && scene.backgroundOverride && (
          <button
            type="button"
            onClick={() => updateScene(storyId, scene.id, { backgroundOverride: undefined })}
            className="mt-1 text-center text-2xs text-text-muted hover:text-status-error"
          >
            Clear custom background
          </button>
        )}
      </div>

      {/* Asset picker modal */}
      {showAssetPicker && (
        <AssetPickerModal
          onSelect={(fileName) => handleCustomImageSelect(fileName, showAssetPicker)}
          onClose={() => setShowAssetPicker(null)}
        />
      )}
    </div>
  );
}
