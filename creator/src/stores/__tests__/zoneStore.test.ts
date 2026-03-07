import { describe, it, expect, beforeEach } from "vitest";
import { useZoneStore } from "../zoneStore";
import type { WorldFile } from "@/types/world";

function makeWorld(zone = "test"): WorldFile {
  return {
    zone,
    startRoom: "room1",
    rooms: {
      room1: { title: "Room 1", description: "First room" },
    },
  };
}

describe("zoneStore undo/redo", () => {
  beforeEach(() => {
    useZoneStore.getState().clearZones();
  });

  it("starts with empty history", () => {
    const store = useZoneStore.getState();
    store.loadZone("test", "/path/test.yaml", makeWorld());
    expect(store.canUndo("test")).toBe(false);
    expect(store.canRedo("test")).toBe(false);
  });

  it("pushes to history on updateZone", () => {
    const store = useZoneStore.getState();
    store.loadZone("test", "/path/test.yaml", makeWorld());

    const updated = { ...makeWorld(), startRoom: "room1" };
    updated.rooms.room1 = { title: "Updated", description: "Changed" };
    store.updateZone("test", updated);

    expect(useZoneStore.getState().canUndo("test")).toBe(true);
    expect(useZoneStore.getState().canRedo("test")).toBe(false);
  });

  it("undo restores previous state", () => {
    const store = useZoneStore.getState();
    const original = makeWorld();
    store.loadZone("test", "/path/test.yaml", original);

    const updated = { ...makeWorld() };
    updated.rooms.room1 = { title: "Updated", description: "Changed" };
    store.updateZone("test", updated);

    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("Updated");

    useZoneStore.getState().undo("test");

    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("Room 1");
    expect(useZoneStore.getState().canRedo("test")).toBe(true);
  });

  it("redo restores undone state", () => {
    const store = useZoneStore.getState();
    store.loadZone("test", "/path/test.yaml", makeWorld());

    const updated = { ...makeWorld() };
    updated.rooms.room1 = { title: "Updated", description: "Changed" };
    store.updateZone("test", updated);
    useZoneStore.getState().undo("test");
    useZoneStore.getState().redo("test");

    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("Updated");
    expect(useZoneStore.getState().canRedo("test")).toBe(false);
  });

  it("new edit clears redo stack", () => {
    const store = useZoneStore.getState();
    store.loadZone("test", "/path/test.yaml", makeWorld());

    const v1 = { ...makeWorld() };
    v1.rooms.room1 = { title: "V1", description: "" };
    store.updateZone("test", v1);

    useZoneStore.getState().undo("test");
    expect(useZoneStore.getState().canRedo("test")).toBe(true);

    const v2 = { ...makeWorld() };
    v2.rooms.room1 = { title: "V2", description: "" };
    useZoneStore.getState().updateZone("test", v2);

    expect(useZoneStore.getState().canRedo("test")).toBe(false);
  });

  it("undo on empty history is a no-op", () => {
    const store = useZoneStore.getState();
    store.loadZone("test", "/path/test.yaml", makeWorld());
    store.undo("test");
    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("Room 1");
  });

  it("multiple undo steps work", () => {
    const store = useZoneStore.getState();
    store.loadZone("test", "/path/test.yaml", makeWorld());

    for (let i = 1; i <= 3; i++) {
      const w = { ...makeWorld() };
      w.rooms.room1 = { title: `V${i}`, description: "" };
      useZoneStore.getState().updateZone("test", w);
    }

    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("V3");

    useZoneStore.getState().undo("test");
    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("V2");

    useZoneStore.getState().undo("test");
    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("V1");

    useZoneStore.getState().undo("test");
    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("Room 1");

    // Can't undo further
    useZoneStore.getState().undo("test");
    expect(useZoneStore.getState().zones.get("test")!.data.rooms.room1.title).toBe("Room 1");
  });

  it("marks zone dirty on undo/redo", () => {
    const store = useZoneStore.getState();
    store.loadZone("test", "/path/test.yaml", makeWorld());
    expect(useZoneStore.getState().zones.get("test")!.dirty).toBe(false);

    const w = { ...makeWorld() };
    w.rooms.room1 = { title: "Changed", description: "" };
    store.updateZone("test", w);
    expect(useZoneStore.getState().zones.get("test")!.dirty).toBe(true);

    useZoneStore.getState().markClean("test");
    expect(useZoneStore.getState().zones.get("test")!.dirty).toBe(false);

    useZoneStore.getState().undo("test");
    expect(useZoneStore.getState().zones.get("test")!.dirty).toBe(true);
  });
});
