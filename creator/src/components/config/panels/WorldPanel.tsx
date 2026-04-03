import type { ConfigPanelProps } from "./types";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";

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
      <Section title="Default Start Room">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Start Room">
            <TextInput
              value={config.world.startRoom}
              onCommit={setStartRoom}
              placeholder="zone:room"
            />
          </FieldRow>
          <p className="text-2xs text-text-muted">
            Format: <code className="font-mono">zone_id:room_id</code> — where
            new players spawn by default.
          </p>
        </div>
      </Section>

      <Section title="Class Start Rooms">
        <p className="mb-2 text-2xs text-text-muted">
          Override the default start room per class. Leave empty to use the
          default.
        </p>
        <div className="flex flex-col gap-1.5">
          {classIds.map((classId) => {
            const cls = config.classes[classId];
            return (
              <FieldRow key={classId} label={cls?.displayName ?? classId}>
                <TextInput
                  value={config.classStartRooms[classId] ?? ""}
                  onCommit={(v) => setClassStartRoom(classId, v)}
                  placeholder="zone:room"
                />
              </FieldRow>
            );
          })}
          {classIds.length === 0 && (
            <p className="text-xs text-text-muted">
              No classes are defined yet. Add them in the class designer before assigning class-specific arrival rooms.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
