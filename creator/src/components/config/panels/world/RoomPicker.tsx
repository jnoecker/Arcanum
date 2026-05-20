import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useZoneStore } from "@/stores/zoneStore";

interface MenuRect {
  top: number;
  left: number;
  width: number;
}

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

export function RoomPicker({ value, onChange, placeholder, allowClear }: RoomPickerProps) {
  const zones = useZoneStore((s) => s.zones);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      .filter((r) => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))
      .slice(0, 100);
  }, [allRooms, query]);

  // Click-outside also has to allow clicks inside the portaled menu — without
  // this check, picking an option immediately closes the menu before the
  // option's onClick fires.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Compute the portaled menu's position from the trigger's bounding rect.
  // The card's `backdrop-filter` creates a stacking context the menu can't
  // win against, so we hoist it to document.body and position it `fixed` —
  // that escapes the trap. Recompute on scroll/resize so the menu follows
  // the trigger when the page moves underneath it.
  useLayoutEffect(() => {
    if (!open) return;
    const recompute = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    recompute();
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [open]);

  const selected = allRooms.find((r) => r.id === value);
  const hasUnknownValue = value && !selected;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ornate-input flex min-h-10 w-full items-center px-2.5 py-1.5 text-left text-xs text-text-primary"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate font-semibold">{selected.title}</span>
            <span className="truncate font-mono text-2xs text-text-muted">{selected.id}</span>
          </span>
        ) : hasUnknownValue ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate italic text-status-warning">Unknown room</span>
            <span className="truncate font-mono text-2xs text-text-muted">{value}</span>
          </span>
        ) : (
          <span className="flex-1 text-text-muted">{placeholder ?? "Select room…"}</span>
        )}
        <span
          className={`ml-2 text-[9px] text-text-muted transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          &#x25B6;
        </span>
      </button>

      {open && menuRect &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              zIndex: 60,
            }}
            className="overflow-hidden rounded border border-border-default bg-bg-elevated shadow-lg"
          >
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
                <p className="px-2 py-2 text-2xs text-text-muted">No rooms match "{query}".</p>
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
                      <span className="text-xs text-text-primary">{r.title}</span>
                      <span className="font-mono text-2xs text-text-muted">{r.id}</span>
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
          </div>,
          document.body,
        )}
    </div>
  );
}
