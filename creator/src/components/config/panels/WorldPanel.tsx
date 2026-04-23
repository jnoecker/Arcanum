import { useEffect, useMemo, useRef, useState } from "react";
import type { ConfigPanelProps } from "./types";
import { Section, FieldRow } from "@/components/ui/FormWidgets";
import { useZoneStore } from "@/stores/zoneStore";
import { ProgressionPanel } from "./ProgressionPanel";

interface RoomOption {
  id: string;
  title: string;
  zoneId: string;
  roomId: string;
}

interface RoomPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
}

function RoomPicker({ value, onChange, placeholder, allowClear }: RoomPickerProps) {
  const zones = useZoneStore((s) => s.zones);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const allRooms = useMemo<RoomOption[]>(() => {
    const rooms: RoomOption[] = [];
    zones.forEach((zoneState, zoneId) => {
      const zoneRooms = zoneState.data.rooms ?? {};
      for (const [roomId, room] of Object.entries(zoneRooms)) {
        rooms.push({
          id: `${zoneId}:${roomId}`,
          title: room.title || roomId,
          zoneId,
          roomId,
        });
      }
    });
    rooms.sort((a, b) => a.id.localeCompare(b.id));
    return rooms;
  }, [zones]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allRooms.slice(0, 100);
    const q = query.toLowerCase();
    return allRooms
      .filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q),
      )
      .slice(0, 100);
  }, [allRooms, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = allRooms.find((r) => r.id === value);
  const hasUnknownValue = value && !selected;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ornate-input flex min-h-11 w-full items-center px-3 py-2 text-left text-xs text-text-primary"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate font-semibold">{selected.title}</span>
            <span className="truncate font-mono text-2xs text-text-muted">
              {selected.id}
            </span>
          </span>
        ) : hasUnknownValue ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate italic text-status-warning">
              Unknown room
            </span>
            <span className="truncate font-mono text-2xs text-text-muted">
              {value}
            </span>
          </span>
        ) : (
          <span className="flex-1 text-text-muted">
            {placeholder ?? "Select room…"}
          </span>
        )}
        <span
          className={`ml-2 text-[9px] text-text-muted transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          &#x25B6;
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded border border-border-default bg-bg-elevated shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${allRooms.length} room${allRooms.length === 1 ? "" : "s"}…`}
            className="w-full border-b border-border-muted bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
          />
          <div className="max-h-56 overflow-y-auto">
            {allRooms.length === 0 ? (
              <p className="px-2 py-2 text-2xs text-text-muted">
                No zones are loaded yet. Open or create a zone first.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-2 text-2xs text-text-muted">
                No rooms match "{query}".
              </p>
            ) : (
              filtered.map((r) => {
                const isActive = r.id === value;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onChange(r.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-border-muted/30 px-2 py-1.5 text-left transition-colors hover:bg-bg-hover ${isActive ? "bg-accent/10" : ""}`}
                  >
                    <span className="text-xs text-text-primary">
                      {r.title}
                    </span>
                    <span className="font-mono text-2xs text-text-muted">
                      {r.id}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {allowClear && value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
              className="w-full border-t border-border-muted bg-bg-primary/50 px-2 py-1 text-2xs text-text-muted hover:text-text-primary"
            >
              Clear override
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function WorldPanel({ config, onChange }: ConfigPanelProps) {
  const classIds = Object.keys(config.classes);

  const setStartRoom = (v: string) =>
    onChange({ world: { ...config.world, startRoom: v } });

  const setClassStartRoom = (classId: string, room: string) => {
    const next = { ...config.classStartRooms };
    if (room) {
      next[classId] = room;
    } else {
      delete next[classId];
    }
    onChange({ classStartRooms: next });
  };

  return (
    <>
      <Section
        title="Default Start Room"
        description="Where new players spawn when their class has no override. Pick any room from the loaded zones — the start room is saved as zone_id:room_id."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Start Room">
            <RoomPicker
              value={config.world.startRoom}
              onChange={setStartRoom}
              placeholder="Select a default spawn room…"
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Class Start Rooms"
        description="Override the default per class. Leave empty to fall back to the default start room above."
      >
        <div className="flex flex-col gap-1.5">
          {classIds.map((classId) => {
            const cls = config.classes[classId];
            return (
              <FieldRow key={classId} label={cls?.displayName ?? classId}>
                <RoomPicker
                  value={config.classStartRooms[classId] ?? ""}
                  onChange={(v) => setClassStartRoom(classId, v)}
                  placeholder="Use default"
                  allowClear
                />
              </FieldRow>
            );
          })}
          {classIds.length === 0 && (
            <p className="text-xs text-text-muted">
              No classes are defined yet. Add them in the class designer before
              assigning class-specific arrival rooms.
            </p>
          )}
        </div>
      </Section>

      <ProgressionPanel config={config} onChange={onChange} />
    </>
  );
}
