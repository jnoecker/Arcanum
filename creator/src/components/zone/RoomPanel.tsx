import type { WorldFile, ExitValue } from "@/types/world";

interface RoomPanelProps {
  zoneId: string;
  roomId: string;
  world: WorldFile;
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

export function RoomPanel({ zoneId, roomId, world }: RoomPanelProps) {
  const room = world.rooms[roomId];
  if (!room) return null;

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
    // Quest giver mob is in this room
    const giverMob = Object.entries(world.mobs ?? {}).find(
      ([mobId]) => mobId === q.giver || `${zoneId}:${mobId}` === q.giver,
    );
    return giverMob && giverMob[1].room === roomId;
  });

  return (
    <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="border-b border-border-default px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {room.title}
        </h3>
        <p className="mt-0.5 text-xs text-text-muted">{roomId}</p>
        {roomId === world.startRoom && (
          <span className="mt-1 inline-block rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            Start Room
          </span>
        )}
      </div>

      {/* Description */}
      <Section title="Description">
        <p className="text-xs leading-relaxed text-text-secondary">
          {room.description}
        </p>
      </Section>

      {/* Exits */}
      <Section title="Exits">
        {exits.length === 0 ? (
          <p className="text-xs text-text-muted">No exits</p>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {exits.map((exit) => (
                <tr key={exit.direction} className="border-b border-border-muted last:border-0">
                  <td className="py-1 pr-2 font-medium text-text-primary">
                    {exit.direction.toUpperCase()}
                  </td>
                  <td className="py-1 text-text-secondary">
                    <span className={exit.target.includes(":") ? "text-accent" : ""}>
                      {exit.target}
                    </span>
                    {exit.hasDoor && (
                      <span className="ml-1 text-status-warning">
                        {exit.isLocked ? "🔒" : "🚪"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Station */}
      {room.station && (
        <Section title="Crafting Station">
          <p className="text-xs text-status-info">{room.station}</p>
        </Section>
      )}

      {/* Mobs */}
      {mobs.length > 0 && (
        <Section title={`Mobs (${mobs.length})`}>
          <ul className="flex flex-col gap-1">
            {mobs.map(([id, mob]) => (
              <li key={id} className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{mob.name}</span>
                <span className="ml-1 text-text-muted">
                  {mob.tier ?? "standard"} L{mob.level ?? 1}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Items */}
      {items.length > 0 && (
        <Section title={`Items (${items.length})`}>
          <ul className="flex flex-col gap-1">
            {items.map(([id, item]) => (
              <li key={id} className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">
                  {item.displayName}
                </span>
                {item.slot && (
                  <span className="ml-1 text-text-muted">[{item.slot}]</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Shops */}
      {shops.length > 0 && (
        <Section title={`Shops (${shops.length})`}>
          <ul className="flex flex-col gap-1">
            {shops.map(([id, shop]) => (
              <li key={id} className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{shop.name}</span>
                <span className="ml-1 text-text-muted">
                  ({shop.items?.length ?? 0} items)
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Gathering Nodes */}
      {gatheringNodes.length > 0 && (
        <Section title={`Gathering (${gatheringNodes.length})`}>
          <ul className="flex flex-col gap-1">
            {gatheringNodes.map(([id, node]) => (
              <li key={id} className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">
                  {node.displayName}
                </span>
                <span className="ml-1 text-text-muted">{node.skill}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Quests */}
      {quests.length > 0 && (
        <Section title={`Quests (${quests.length})`}>
          <ul className="flex flex-col gap-1">
            {quests.map(([id, quest]) => (
              <li key={id} className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{quest.name}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Media */}
      {(room.image || room.music || room.ambient) && (
        <Section title="Media">
          {room.image && (
            <p className="text-xs text-text-muted">Image: {room.image}</p>
          )}
          {room.music && (
            <p className="text-xs text-text-muted">Music: {room.music}</p>
          )}
          {room.ambient && (
            <p className="text-xs text-text-muted">Ambient: {room.ambient}</p>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border-muted px-4 py-3">
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}
