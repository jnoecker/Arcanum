import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useZoneStore } from "@/stores/zoneStore";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { normalizeAssetRef } from "@/lib/assetRefs";
import type {
  WorldFile,
  RoomFile,
  MobFile,
  ItemFile,
  FeatureFile,
  GatheringNodeFile,
  QuestFile,
  DialogueNodeFile,
  DialogueChoiceFile,
  ExitValue,
} from "@/types/world";

// ─── Direction metadata ─────────────────────────────────────────────

const DIRECTION_LABELS: Record<string, string> = {
  n: "North",
  s: "South",
  e: "East",
  w: "West",
  ne: "Northeast",
  nw: "Northwest",
  se: "Southeast",
  sw: "Southwest",
  u: "Up",
  d: "Down",
  in: "In",
  out: "Out",
};

const DIRECTION_ORDER = ["nw", "n", "ne", "w", "e", "sw", "s", "se", "u", "d", "in", "out"];

function directionLabel(dir: string): string {
  return DIRECTION_LABELS[dir.toLowerCase()] ?? dir.toUpperCase();
}

// ─── Types ──────────────────────────────────────────────────────────

interface HistoryEntry {
  zoneId: string;
  roomId: string;
}

interface ExitTarget {
  direction: string;
  label: string;
  targetZoneId: string;
  targetRoomId: string;
  crossZone: boolean;
  door?: { state: string; keyItemId?: string };
  targetExists: boolean;
  targetMissingReason?: string;
}

type InspectTarget =
  | { kind: "mob"; id: string; mob: MobFile }
  | { kind: "item"; id: string; item: ItemFile; source: "room" | "feature"; featureId?: string }
  | { kind: "feature"; id: string; feature: FeatureFile }
  | { kind: "gathering"; id: string; node: GatheringNodeFile };

// ─── Helpers ────────────────────────────────────────────────────────

function parseExit(value: string | ExitValue): { target: string; door?: ExitValue["door"] } {
  if (typeof value === "string") return { target: value };
  return { target: value.to, door: value.door };
}

function resolveExitTarget(
  currentZoneId: string,
  exits: Record<string, string | ExitValue> | undefined,
  loadedZones: Map<string, { data: WorldFile }>,
): ExitTarget[] {
  if (!exits) return [];
  const entries = Object.entries(exits);
  entries.sort((a, b) => {
    const ai = DIRECTION_ORDER.indexOf(a[0].toLowerCase());
    const bi = DIRECTION_ORDER.indexOf(b[0].toLowerCase());
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  return entries.map(([dir, raw]) => {
    const { target, door } = parseExit(raw);
    const crossZone = target.startsWith("xzone:");
    let targetZoneId = currentZoneId;
    let targetRoomId = target;
    if (crossZone) {
      const rest = target.slice("xzone:".length);
      const [zone, ...roomParts] = rest.split(":");
      targetZoneId = zone ?? currentZoneId;
      targetRoomId = roomParts.join(":");
    }
    const targetZone = loadedZones.get(targetZoneId);
    let targetExists = false;
    let targetMissingReason: string | undefined;
    if (!targetZone) {
      targetMissingReason = `Zone "${targetZoneId}" is not loaded`;
    } else if (!targetZone.data.rooms?.[targetRoomId]) {
      targetMissingReason = `Room "${targetRoomId}" not found in zone`;
    } else {
      targetExists = true;
    }
    return {
      direction: dir,
      label: directionLabel(dir),
      targetZoneId,
      targetRoomId,
      crossZone,
      door: door
        ? {
            state: door.initialState ?? (door.locked ? "locked" : door.closed ? "closed" : "open"),
            keyItemId: door.keyItemId ?? door.key,
          }
        : undefined,
      targetExists,
      targetMissingReason,
    };
  });
}

function collectRoomMobs(world: WorldFile, roomId: string): Array<[string, MobFile]> {
  const out: Array<[string, MobFile]> = [];
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    if (mob.room === roomId) out.push([id, mob]);
  }
  return out;
}

function collectRoomItems(world: WorldFile, roomId: string): Array<[string, ItemFile]> {
  const out: Array<[string, ItemFile]> = [];
  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (item.room === roomId) out.push([id, item]);
  }
  return out;
}

function collectRoomGathering(world: WorldFile, roomId: string): Array<[string, GatheringNodeFile]> {
  const out: Array<[string, GatheringNodeFile]> = [];
  for (const [id, node] of Object.entries(world.gatheringNodes ?? {})) {
    if (node.room === roomId) out.push([id, node]);
  }
  return out;
}

// ─── Image hook ─────────────────────────────────────────────────────

function useRoomImage(imageRef: string | undefined): string | null {
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    setDataUrl(null);
    if (!imageRef || !assetsDir) return;
    const normalized = normalizeAssetRef(imageRef);
    if (!normalized || normalized.startsWith("/") || normalized.startsWith("http")) return;
    const path = `${assetsDir}\\images\\${normalized}`;
    let cancelled = false;
    invoke<string>("read_image_data_url", { path })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageRef, assetsDir]);
  return dataUrl;
}

// ─── Room image component ───────────────────────────────────────────

function RoomImage({ imageRef }: { imageRef: string | undefined }) {
  const dataUrl = useRoomImage(imageRef);
  if (!imageRef) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border-default/60 bg-bg-abyss/60">
          <div className="absolute inset-0 flex items-center justify-center text-xs italic text-text-muted">
            No room image
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border-default/60 bg-bg-abyss/60 shadow-[var(--shadow-drop)]">
        {dataUrl ? (
          <img src={dataUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg-abyss/70 to-transparent" />
      </div>
    </div>
  );
}

// ─── Small image tile (mobs/items/features) ─────────────────────────

function EntityThumb({ imageRef, emoji }: { imageRef: string | undefined; emoji: string }) {
  const dataUrl = useRoomImage(imageRef);
  return (
    <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg border border-border-default/60 bg-bg-abyss/70">
      {dataUrl ? (
        <img src={dataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl opacity-70">
          {emoji}
        </div>
      )}
    </div>
  );
}

// ─── Dialogue walker ────────────────────────────────────────────────

interface DialogueViewProps {
  mobId: string;
  mob: MobFile;
  questsById: Record<string, QuestFile>;
  onClose: () => void;
  onAcceptQuest: (questId: string) => void;
  acceptedQuests: Set<string>;
}

function DialogueView({
  mobId,
  mob,
  questsById,
  onClose,
  onAcceptQuest,
  acceptedQuests,
}: DialogueViewProps) {
  const dialogue = mob.dialogue ?? {};
  const nodeIds = Object.keys(dialogue);
  const [currentNodeId, setCurrentNodeId] = useState<string>(
    dialogue["root"] ? "root" : (nodeIds[0] ?? ""),
  );
  const [path, setPath] = useState<string[]>([]);

  useEffect(() => {
    // Reset when opening dialogue for a new mob
    setCurrentNodeId(dialogue["root"] ? "root" : (nodeIds[0] ?? ""));
    setPath([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobId]);

  const node: DialogueNodeFile | undefined = dialogue[currentNodeId];
  const mobQuests = (mob.quests ?? [])
    .map((qid) => ({ id: qid, quest: questsById[qid] }))
    .filter((q): q is { id: string; quest: QuestFile } => !!q.quest);

  if (!node) {
    return (
      <div className="rounded-xl border border-border-default/60 bg-bg-surface/70 p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h3 className="font-display text-lg text-accent">{mob.name}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted transition hover:text-text-primary"
          >
            Close
          </button>
        </div>
        <p className="italic text-text-muted">
          {nodeIds.length === 0
            ? "This character has no dialogue defined."
            : `Dialogue node "${currentNodeId}" not found.`}
        </p>
        {mobQuests.length > 0 && (
          <div className="mt-5 border-t border-border-default/40 pt-4">
            <div className="mb-2 font-display text-xs uppercase tracking-wide-ui text-text-muted">
              Offers Quests
            </div>
            <ul className="space-y-2">
              {mobQuests.map(({ id, quest }) => (
                <QuestOfferRow
                  key={id}
                  questId={id}
                  quest={quest}
                  accepted={acceptedQuests.has(id)}
                  onAccept={() => onAcceptQuest(id)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const visit = (next: string) => {
    setPath((p) => [...p, currentNodeId]);
    setCurrentNodeId(next);
  };

  const goBack = () => {
    setPath((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1]!;
      setCurrentNodeId(prev);
      return p.slice(0, -1);
    });
  };

  return (
    <div className="rounded-xl border border-border-default/60 bg-bg-surface/70 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-xs uppercase tracking-wide-ui text-text-muted">
            Speaking with
          </div>
          <h3 className="font-display text-lg text-accent">{mob.name}</h3>
        </div>
        <div className="flex items-center gap-3">
          {path.length > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-text-muted transition hover:text-text-primary"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted transition hover:text-text-primary"
          >
            Close
          </button>
        </div>
      </div>

      <blockquote className="border-l-2 border-accent/50 pl-4 font-body text-base leading-relaxed text-text-primary">
        "{node.text}"
      </blockquote>

      {node.choices && node.choices.length > 0 && (
        <div className="mt-5 space-y-2">
          {node.choices.map((choice, i) => (
            <ChoiceButton
              key={i}
              choice={choice}
              onPick={() => {
                if (choice.action?.startsWith("accept_quest:")) {
                  const qid = choice.action.slice("accept_quest:".length).trim();
                  if (qid) onAcceptQuest(qid);
                }
                if (choice.next && dialogue[choice.next]) {
                  visit(choice.next);
                }
              }}
            />
          ))}
        </div>
      )}

      {mobQuests.length > 0 && (
        <div className="mt-6 border-t border-border-default/40 pt-4">
          <div className="mb-2 font-display text-xs uppercase tracking-wide-ui text-text-muted">
            Offers Quests
          </div>
          <ul className="space-y-2">
            {mobQuests.map(({ id, quest }) => (
              <QuestOfferRow
                key={id}
                questId={id}
                quest={quest}
                accepted={acceptedQuests.has(id)}
                onAccept={() => onAcceptQuest(id)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChoiceButton({
  choice,
  onPick,
}: {
  choice: DialogueChoiceFile;
  onPick: () => void;
}) {
  const gates: string[] = [];
  if (choice.minLevel) gates.push(`Lvl ${choice.minLevel}+`);
  if (choice.requiredClass) gates.push(choice.requiredClass);
  return (
    <button
      type="button"
      onClick={onPick}
      className="focus-ring w-full rounded-lg border border-border-default/60 bg-bg-abyss/60 px-4 py-2.5 text-left text-sm text-text-primary transition hover:border-accent/60 hover:bg-accent/10"
    >
      <div className="flex items-center justify-between gap-3">
        <span>{choice.text}</span>
        <div className="flex flex-none items-center gap-2 text-xs text-text-muted">
          {gates.map((g) => (
            <span key={g} className="rounded-full border border-border-default/60 px-2 py-0.5">
              {g}
            </span>
          ))}
          {choice.action && (
            <span className="rounded-full border border-accent/40 px-2 py-0.5 text-accent">
              {choice.action}
            </span>
          )}
          {choice.next && <span className="text-accent">→</span>}
        </div>
      </div>
    </button>
  );
}

function QuestOfferRow({
  questId,
  quest,
  accepted,
  onAccept,
}: {
  questId: string;
  quest: QuestFile;
  accepted: boolean;
  onAccept: () => void;
}) {
  return (
    <li className="rounded-lg border border-border-default/60 bg-bg-abyss/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-sm text-accent">{quest.name}</div>
          {quest.description && (
            <p className="mt-1 text-xs italic text-text-muted">{quest.description}</p>
          )}
          {quest.objectives && quest.objectives.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-text-secondary">
              {quest.objectives.map((obj, i) => (
                <li key={i}>
                  ◆ {obj.description ?? `${obj.type} ${obj.targetKey}`}
                  {obj.count && obj.count > 1 ? ` ×${obj.count}` : ""}
                </li>
              ))}
            </ul>
          )}
          {quest.rewards && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
              {quest.rewards.xp != null && <span>+{quest.rewards.xp} XP</span>}
              {quest.rewards.gold != null && <span>+{quest.rewards.gold} gold</span>}
              {quest.rewards.currencies &&
                Object.entries(quest.rewards.currencies).map(([k, v]) => (
                  <span key={k}>
                    +{v} {k}
                  </span>
                ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onAccept}
          disabled={accepted}
          className="focus-ring flex-none rounded-full border border-accent/40 px-3 py-1 text-xs text-accent transition hover:bg-accent/10 disabled:cursor-default disabled:border-border-default/60 disabled:text-text-muted disabled:hover:bg-transparent"
          title={`Quest ID: ${questId}`}
        >
          {accepted ? "Accepted" : "Accept"}
        </button>
      </div>
    </li>
  );
}

// ─── Inspect panel ──────────────────────────────────────────────────

function InspectPanel({
  target,
  onClose,
  onOpenDialogue,
}: {
  target: InspectTarget;
  onClose: () => void;
  onOpenDialogue?: (mobId: string) => void;
}) {
  let image: string | undefined;
  let title: string;
  let description: string | undefined;
  let body: React.ReactNode = null;

  if (target.kind === "mob") {
    image = target.mob.image;
    title = target.mob.name;
    description = target.mob.description;
    const stats: Array<[string, string | number]> = [];
    if (target.mob.level) stats.push(["Level", target.mob.level]);
    if (target.mob.tier) stats.push(["Tier", target.mob.tier]);
    if (target.mob.hp) stats.push(["HP", target.mob.hp]);
    if (target.mob.minDamage != null && target.mob.maxDamage != null)
      stats.push(["Damage", `${target.mob.minDamage}–${target.mob.maxDamage}`]);
    if (target.mob.armor) stats.push(["Armor", target.mob.armor]);
    if (target.mob.faction) stats.push(["Faction", target.mob.faction]);
    body = (
      <>
        {stats.length > 0 && <StatGrid stats={stats} />}
        {target.mob.dialogue && Object.keys(target.mob.dialogue).length > 0 && onOpenDialogue && (
          <button
            type="button"
            onClick={() => onOpenDialogue(target.id)}
            className="focus-ring mt-4 rounded-full border border-accent/50 bg-accent/10 px-4 py-1.5 text-sm text-accent transition hover:bg-accent/20"
          >
            Talk
          </button>
        )}
      </>
    );
  } else if (target.kind === "item") {
    image = target.item.image;
    title = target.item.displayName;
    description = target.item.description;
    const stats: Array<[string, string | number]> = [];
    if (target.item.slot) stats.push(["Slot", target.item.slot]);
    if (target.item.damage) stats.push(["Damage", target.item.damage]);
    if (target.item.armor) stats.push(["Armor", target.item.armor]);
    if (target.item.basePrice) stats.push(["Price", `${target.item.basePrice}g`]);
    if (target.item.consumable) stats.push(["Consumable", target.item.charges ?? "—"]);
    if (target.item.onUse?.healHp) stats.push(["Heals", `${target.item.onUse.healHp} HP`]);
    if (target.item.onUse?.grantXp) stats.push(["Grants", `${target.item.onUse.grantXp} XP`]);
    if (target.item.stats) {
      for (const [k, v] of Object.entries(target.item.stats)) {
        if (v) stats.push([k, `+${v}`]);
      }
    }
    body = stats.length > 0 ? <StatGrid stats={stats} /> : null;
  } else if (target.kind === "feature") {
    title = target.feature.displayName;
    const stats: Array<[string, string | number]> = [
      ["Type", target.feature.type],
      ["Keyword", target.feature.keyword],
    ];
    if (target.feature.initialState) stats.push(["State", target.feature.initialState]);
    if (target.feature.keyItemId) stats.push(["Key", target.feature.keyItemId]);
    body = (
      <>
        <StatGrid stats={stats} />
        {target.feature.text && (
          <div className="mt-4 rounded-lg border border-border-default/60 bg-bg-abyss/60 p-4 font-body italic text-text-primary">
            "{target.feature.text}"
          </div>
        )}
        {target.feature.items && target.feature.items.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 font-display text-xs uppercase tracking-wide-ui text-text-muted">
              Contents
            </div>
            <ul className="space-y-0.5 text-sm text-text-secondary">
              {target.feature.items.map((id) => (
                <li key={id}>◆ {id}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  } else {
    image = target.node.image;
    title = target.node.displayName;
    const stats: Array<[string, string | number]> = [
      ["Skill", target.node.skill],
    ];
    if (target.node.skillRequired) stats.push(["Req. Level", target.node.skillRequired]);
    if (target.node.xpReward) stats.push(["XP", target.node.xpReward]);
    if (target.node.respawnSeconds) stats.push(["Respawn", `${target.node.respawnSeconds}s`]);
    body = (
      <>
        <StatGrid stats={stats} />
        <div className="mt-4">
          <div className="mb-1 font-display text-xs uppercase tracking-wide-ui text-text-muted">
            Yields
          </div>
          <ul className="space-y-0.5 text-sm text-text-secondary">
            {target.node.yields.map((y, i) => (
              <li key={i}>
                ◆ {y.itemId}
                {y.minQuantity && y.maxQuantity
                  ? ` ×${y.minQuantity}–${y.maxQuantity}`
                  : ""}
              </li>
            ))}
            {(target.node.rareYields ?? []).map((r, i) => (
              <li key={`r${i}`} className="text-accent">
                ✦ {r.itemId}
                {r.quantity && r.quantity > 1 ? ` ×${r.quantity}` : ""}
                <span className="text-text-muted"> ({(r.dropChance * 100).toFixed(1)}%)</span>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  const imageDataUrl = useRoomImage(image);

  return (
    <div className="rounded-xl border border-border-default/60 bg-bg-surface/70 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-xs uppercase tracking-wide-ui text-text-muted">
            {target.kind === "mob"
              ? "Creature"
              : target.kind === "item"
                ? "Item"
                : target.kind === "feature"
                  ? "Feature"
                  : "Resource"}
          </div>
          <h3 className="font-display text-lg text-accent">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-text-muted transition hover:text-text-primary"
        >
          Close
        </button>
      </div>
      {imageDataUrl && (
        <img
          src={imageDataUrl}
          alt=""
          className="mb-4 max-h-64 w-full rounded-lg border border-border-default/60 object-contain"
        />
      )}
      {description && (
        <p className="mb-4 font-body italic leading-relaxed text-text-primary">
          {description}
        </p>
      )}
      {body}
    </div>
  );
}

function StatGrid({ stats }: { stats: Array<[string, string | number]> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {stats.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-border-default/30 py-1">
          <dt className="text-text-muted">{k}</dt>
          <dd className="text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────

export function PlaytestPanel() {
  const zones = useZoneStore((s) => s.zones);
  const project = useProjectStore((s) => s.project);
  const pendingNavigation = useProjectStore((s) => s.pendingNavigation);
  const consumeNavigation = useProjectStore((s) => s.consumeNavigation);

  const zoneIds = useMemo(() => Array.from(zones.keys()).sort(), [zones]);

  const [currentZoneId, setCurrentZoneId] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dialogueMobId, setDialogueMobId] = useState<string | null>(null);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(null);
  const [acceptedQuests, setAcceptedQuests] = useState<Set<string>>(new Set());

  // Consume pending navigation from the zone editor's "Playtest" button.
  useEffect(() => {
    if (!pendingNavigation) return;
    const nav = consumeNavigation();
    if (!nav) return;
    const zone = zones.get(nav.zoneId);
    if (!zone) return;
    const room =
      nav.roomId ?? zone.data.startRoom ?? Object.keys(zone.data.rooms ?? {})[0] ?? null;
    setCurrentZoneId(nav.zoneId);
    setCurrentRoomId(room);
    setHistory([]);
    setDialogueMobId(null);
    setInspectTarget(null);
  }, [pendingNavigation, consumeNavigation, zones]);

  // Bootstrap when zones load or change.
  useEffect(() => {
    if (currentZoneId && zones.has(currentZoneId)) return;
    const first = zoneIds[0];
    if (!first) {
      setCurrentZoneId(null);
      setCurrentRoomId(null);
      return;
    }
    const zone = zones.get(first)!;
    setCurrentZoneId(first);
    setCurrentRoomId(zone.data.startRoom ?? Object.keys(zone.data.rooms ?? {})[0] ?? null);
    setHistory([]);
    setDialogueMobId(null);
    setInspectTarget(null);
  }, [zones, zoneIds, currentZoneId]);

  const currentZone = currentZoneId ? zones.get(currentZoneId) : undefined;
  const world = currentZone?.data;
  const room: RoomFile | undefined =
    world && currentRoomId ? world.rooms?.[currentRoomId] : undefined;

  const roomMobs = useMemo(
    () => (world && currentRoomId ? collectRoomMobs(world, currentRoomId) : []),
    [world, currentRoomId],
  );
  const roomItems = useMemo(
    () => (world && currentRoomId ? collectRoomItems(world, currentRoomId) : []),
    [world, currentRoomId],
  );
  const roomGathering = useMemo(
    () => (world && currentRoomId ? collectRoomGathering(world, currentRoomId) : []),
    [world, currentRoomId],
  );
  const roomFeatures: Array<[string, FeatureFile]> = useMemo(
    () => Object.entries(room?.features ?? {}),
    [room],
  );
  const exits: ExitTarget[] = useMemo(
    () =>
      currentZoneId && currentRoomId
        ? resolveExitTarget(currentZoneId, room?.exits, zones)
        : [],
    [currentZoneId, currentRoomId, room, zones],
  );

  const questsById = world?.quests ?? {};

  const traverse = useCallback(
    (zoneId: string, roomId: string) => {
      if (!zones.has(zoneId)) return;
      const targetZone = zones.get(zoneId)!;
      if (!targetZone.data.rooms?.[roomId]) return;
      setHistory((h) => [
        ...h,
        { zoneId: currentZoneId!, roomId: currentRoomId! },
      ]);
      setCurrentZoneId(zoneId);
      setCurrentRoomId(roomId);
      setDialogueMobId(null);
      setInspectTarget(null);
    },
    [zones, currentZoneId, currentRoomId],
  );

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1]!;
      setCurrentZoneId(prev.zoneId);
      setCurrentRoomId(prev.roomId);
      setDialogueMobId(null);
      setInspectTarget(null);
      return h.slice(0, -1);
    });
  }, []);

  const jumpToStart = useCallback(() => {
    if (!currentZoneId) return;
    const zone = zones.get(currentZoneId);
    if (!zone) return;
    const start = zone.data.startRoom ?? Object.keys(zone.data.rooms ?? {})[0];
    if (!start) return;
    setHistory((h) => [...h, { zoneId: currentZoneId, roomId: currentRoomId ?? start }]);
    setCurrentRoomId(start);
    setDialogueMobId(null);
    setInspectTarget(null);
  }, [zones, currentZoneId, currentRoomId]);

  const handleZoneChange = (zoneId: string) => {
    const zone = zones.get(zoneId);
    if (!zone) return;
    const start = zone.data.startRoom ?? Object.keys(zone.data.rooms ?? {})[0] ?? null;
    setHistory([]);
    setCurrentZoneId(zoneId);
    setCurrentRoomId(start);
    setDialogueMobId(null);
    setInspectTarget(null);
  };

  const acceptQuest = useCallback((questId: string) => {
    setAcceptedQuests((s) => {
      const next = new Set(s);
      next.add(questId);
      return next;
    });
  }, []);

  // Quests visible in current room: any mob in this room that has quests.
  const availableQuests = useMemo(() => {
    const out: Array<{ id: string; quest: QuestFile; giverName: string }> = [];
    for (const [, mob] of roomMobs) {
      for (const qid of mob.quests ?? []) {
        const q = questsById[qid];
        if (q) out.push({ id: qid, quest: q, giverName: mob.name });
      }
    }
    return out;
  }, [roomMobs, questsById]);

  // ─── Render ────────────────────────────────────────────────────

  if (!project) {
    return (
      <EmptyShell>
        <p>Open a project to playtest its zones.</p>
      </EmptyShell>
    );
  }

  if (zoneIds.length === 0) {
    return (
      <EmptyShell>
        <p>This project has no zones loaded yet. Open a zone in the editor first.</p>
      </EmptyShell>
    );
  }

  if (!world || !room) {
    return (
      <EmptyShell>
        <p>
          {currentZoneId && !world
            ? `Zone "${currentZoneId}" is not loaded.`
            : "No rooms in this zone."}
        </p>
      </EmptyShell>
    );
  }

  const dialogueMob = dialogueMobId ? world.mobs?.[dialogueMobId] : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex-none border-b border-border-default/40 bg-bg-surface/40 px-6 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="font-display text-xs uppercase tracking-wide-ui text-text-muted">
              Zone
            </label>
            <select
              value={currentZoneId ?? ""}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="focus-ring rounded-md border border-border-default/60 bg-bg-abyss/70 px-3 py-1.5 font-body text-sm text-text-primary"
            >
              {zoneIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>Room:</span>
            <span className="font-mono text-text-secondary">{currentRoomId}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={history.length === 0}
              className="focus-ring rounded-full border border-border-default/60 px-3 py-1 text-xs text-text-secondary transition hover:border-accent/60 hover:text-accent disabled:cursor-default disabled:opacity-40 disabled:hover:border-border-default/60 disabled:hover:text-text-secondary"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={jumpToStart}
              className="focus-ring rounded-full border border-border-default/60 px-3 py-1 text-xs text-text-secondary transition hover:border-accent/60 hover:text-accent"
            >
              Start room
            </button>
          </div>
        </div>
      </div>

      {/* Main body */}
      <div className="flex min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-7xl gap-6">
          {/* Left: room + overlays */}
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <RoomImage imageRef={room.image} />

            <div>
              <h2 className="font-display text-2xl text-accent">{room.title}</h2>
              <p className="mt-3 whitespace-pre-wrap font-body text-base leading-relaxed text-text-primary">
                {room.description}
              </p>
            </div>

            {/* Room flags */}
            <RoomBadges room={room} />

            {/* Presence lists */}
            {(roomMobs.length > 0 ||
              roomItems.length > 0 ||
              roomFeatures.length > 0 ||
              roomGathering.length > 0) && (
              <div className="rounded-xl border border-border-default/60 bg-bg-surface/40 p-4">
                <div className="mb-3 font-display text-xs uppercase tracking-wide-ui text-text-muted">
                  Here
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {roomMobs.map(([id, mob]) => (
                    <PresenceRow
                      key={`mob-${id}`}
                      imageRef={mob.image}
                      emoji="🧍"
                      title={mob.name}
                      subtitle={mobSubtitle(mob)}
                      onClick={() =>
                        setInspectTarget({ kind: "mob", id, mob })
                      }
                      badge={
                        mob.quests && mob.quests.length > 0
                          ? "Quest"
                          : mob.dialogue && Object.keys(mob.dialogue).length > 0
                            ? "Talks"
                            : undefined
                      }
                    />
                  ))}
                  {roomItems.map(([id, item]) => (
                    <PresenceRow
                      key={`item-${id}`}
                      imageRef={item.image}
                      emoji="📦"
                      title={item.displayName}
                      subtitle={item.slot ?? (item.consumable ? "Consumable" : "Item")}
                      onClick={() =>
                        setInspectTarget({ kind: "item", id, item, source: "room" })
                      }
                    />
                  ))}
                  {roomGathering.map(([id, node]) => (
                    <PresenceRow
                      key={`gather-${id}`}
                      imageRef={node.image}
                      emoji="⛏️"
                      title={node.displayName}
                      subtitle={`${node.skill}${node.skillRequired ? ` · Lvl ${node.skillRequired}` : ""}`}
                      onClick={() =>
                        setInspectTarget({ kind: "gathering", id, node })
                      }
                    />
                  ))}
                  {roomFeatures.map(([id, feature]) => (
                    <PresenceRow
                      key={`feat-${id}`}
                      imageRef={undefined}
                      emoji={featureEmoji(feature.type)}
                      title={feature.displayName}
                      subtitle={feature.type}
                      onClick={() =>
                        setInspectTarget({ kind: "feature", id, feature })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inspect / dialogue overlays */}
            {inspectTarget && (
              <InspectPanel
                target={inspectTarget}
                onClose={() => setInspectTarget(null)}
                onOpenDialogue={(mobId) => {
                  setInspectTarget(null);
                  setDialogueMobId(mobId);
                }}
              />
            )}
            {dialogueMobId && dialogueMob && (
              <DialogueView
                mobId={dialogueMobId}
                mob={dialogueMob}
                questsById={questsById}
                onClose={() => setDialogueMobId(null)}
                onAcceptQuest={acceptQuest}
                acceptedQuests={acceptedQuests}
              />
            )}

            {/* Exits */}
            <div>
              <div className="mb-2 font-display text-xs uppercase tracking-wide-ui text-text-muted">
                Exits
              </div>
              {exits.length === 0 ? (
                <p className="text-sm italic text-text-muted">No exits from this room.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {exits.map((exit) => (
                    <ExitButton
                      key={exit.direction}
                      exit={exit}
                      onClick={() =>
                        exit.targetExists
                          ? traverse(exit.targetZoneId, exit.targetRoomId)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: quest log */}
          <aside className="hidden w-72 flex-none flex-col gap-4 lg:flex">
            <QuestLog
              availableQuests={availableQuests}
              acceptedQuests={acceptedQuests}
              questsById={questsById}
            />
            <HistoryList history={history} />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Helper subcomponents ───────────────────────────────────────────

function EmptyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-border-default/60 bg-bg-surface/50 p-8 text-center font-body italic text-text-muted">
        {children}
      </div>
    </div>
  );
}

function RoomBadges({ room }: { room: RoomFile }) {
  const flags: string[] = [];
  if (room.bank) flags.push("Bank");
  if (room.tavern) flags.push("Tavern");
  if (room.dungeon) flags.push("Dungeon");
  if (room.auction) flags.push("Auction");
  if (room.stylist) flags.push("Stylist");
  if (room.housingBroker) flags.push("Housing Broker");
  if (room.station) flags.push(`Station: ${room.station}`);
  if (room.terrain) flags.push(room.terrain);
  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <span
          key={f}
          className="rounded-full border border-accent/30 bg-accent/5 px-2.5 py-0.5 font-display text-[10px] uppercase tracking-wide-ui text-accent"
        >
          {f}
        </span>
      ))}
    </div>
  );
}

function PresenceRow({
  imageRef,
  emoji,
  title,
  subtitle,
  badge,
  onClick,
}: {
  imageRef: string | undefined;
  emoji: string;
  title: string;
  subtitle?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring group flex items-center gap-3 rounded-lg border border-border-default/60 bg-bg-abyss/50 p-2 text-left transition hover:border-accent/50 hover:bg-accent/5"
    >
      <EntityThumb imageRef={imageRef} emoji={emoji} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm text-text-primary group-hover:text-accent">
          {title}
        </div>
        {subtitle && <div className="truncate text-xs text-text-muted">{subtitle}</div>}
      </div>
      {badge && (
        <span className="flex-none rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wide-ui text-accent">
          {badge}
        </span>
      )}
    </button>
  );
}

function ExitButton({ exit, onClick }: { exit: ExitTarget; onClick?: () => void }) {
  const disabled = !exit.targetExists;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? (exit.targetMissingReason ?? "Target not loaded")
          : `${exit.targetZoneId}:${exit.targetRoomId}`
      }
      className={`focus-ring group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
        disabled
          ? "cursor-not-allowed border-border-default/40 bg-bg-abyss/30 text-text-muted"
          : "border-accent/40 bg-accent/5 text-text-primary hover:border-accent hover:bg-accent/15 hover:text-accent"
      }`}
    >
      <span className="font-display text-xs uppercase tracking-wide-ui text-accent group-disabled:text-text-muted">
        {exit.label}
      </span>
      <span className="text-xs text-text-muted">→ {exit.targetRoomId}</span>
      {exit.crossZone && (
        <span className="rounded-full border border-accent/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide-ui text-accent">
          {exit.targetZoneId}
        </span>
      )}
      {exit.door && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide-ui ${
            exit.door.state === "locked"
              ? "border border-status-error/40 text-status-error"
              : exit.door.state === "closed"
                ? "border border-border-default/60 text-text-muted"
                : "border border-border-default/40 text-text-muted"
          }`}
        >
          {exit.door.state}
        </span>
      )}
    </button>
  );
}

function QuestLog({
  availableQuests,
  acceptedQuests,
  questsById,
}: {
  availableQuests: Array<{ id: string; quest: QuestFile; giverName: string }>;
  acceptedQuests: Set<string>;
  questsById: Record<string, QuestFile>;
}) {
  const accepted = Array.from(acceptedQuests)
    .map((id) => ({ id, quest: questsById[id] }))
    .filter((q): q is { id: string; quest: QuestFile } => !!q.quest);
  return (
    <div className="rounded-xl border border-border-default/60 bg-bg-surface/40 p-4">
      <div className="mb-2 font-display text-xs uppercase tracking-wide-ui text-text-muted">
        Quest Log
      </div>
      {availableQuests.length === 0 && accepted.length === 0 && (
        <p className="text-xs italic text-text-muted">No quests here.</p>
      )}
      {availableQuests.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 font-display text-[10px] uppercase tracking-wide-ui text-accent">
            Offered
          </div>
          <ul className="space-y-1 text-xs">
            {availableQuests.map(({ id, quest, giverName }) => (
              <li
                key={id}
                className={`rounded-md border px-2 py-1 ${
                  acceptedQuests.has(id)
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border-default/60 bg-bg-abyss/50 text-text-secondary"
                }`}
              >
                <div className="font-display">{quest.name}</div>
                <div className="text-[10px] text-text-muted">from {giverName}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {accepted.length > 0 && (
        <div>
          <div className="mb-1 font-display text-[10px] uppercase tracking-wide-ui text-accent">
            Accepted
          </div>
          <ul className="space-y-1 text-xs">
            {accepted.map(({ id, quest }) => (
              <li
                key={id}
                className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-text-primary"
              >
                <div className="font-display text-accent">{quest.name}</div>
                {quest.objectives && quest.objectives.length > 0 && (
                  <div className="mt-0.5 text-[10px] text-text-muted">
                    ◆ {quest.objectives[0]!.description ?? quest.objectives[0]!.type}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HistoryList({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;
  const recent = history.slice(-6).reverse();
  return (
    <div className="rounded-xl border border-border-default/60 bg-bg-surface/40 p-4">
      <div className="mb-2 font-display text-xs uppercase tracking-wide-ui text-text-muted">
        Path
      </div>
      <ol className="space-y-0.5 text-[11px] text-text-muted">
        {recent.map((h, i) => (
          <li key={i} className="truncate">
            <span className="font-mono">{h.zoneId}</span>:{h.roomId}
          </li>
        ))}
      </ol>
    </div>
  );
}

function featureEmoji(type: string): string {
  switch (type.toUpperCase()) {
    case "CONTAINER":
      return "📦";
    case "LEVER":
      return "🎚️";
    case "SIGN":
      return "📜";
    default:
      return "◆";
  }
}

function mobSubtitle(mob: MobFile): string {
  const parts: string[] = [];
  if (mob.level) parts.push(`Lvl ${mob.level}`);
  if (mob.tier) parts.push(mob.tier);
  if (mob.category) parts.push(mob.category);
  return parts.join(" · ");
}
