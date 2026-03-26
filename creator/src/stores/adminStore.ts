import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  AdminConfig,
  AdminConnectionStatus,
  AdminOverview,
  HealthResponse,
  PlayerSummary,
  PlayerDetail,
  StaffToggleResult,
  ZoneSummary,
  ZoneDetail,
  RoomDetailResponse,
  MobSummary,
  AbilityEntry,
  EffectEntry,
  QuestEntry,
  AchievementEntry,
  ShopEntry,
  ItemEntry,
  ReloadResult,
  ReloadTarget,
  BroadcastResult,
} from "@/types/admin";

const POLL_INTERVAL = 10_000; // 10 seconds

interface AdminStore {
  // Connection
  url: string;
  token: string;
  connectionStatus: AdminConnectionStatus;
  lastError: string | null;
  health: HealthResponse | null;

  // Cached data — overview
  overview: AdminOverview | null;

  // Cached data — players
  players: PlayerSummary[];
  selectedPlayer: PlayerDetail | null;
  playerSearchResults: PlayerDetail | null;

  // Cached data — world
  zones: ZoneSummary[];
  selectedZone: ZoneDetail | null;
  selectedRoom: RoomDetailResponse | null;
  mobs: MobSummary[];
  selectedMob: MobSummary | null;

  // Cached data — content
  abilities: AbilityEntry[];
  selectedAbility: AbilityEntry | null;
  effects: EffectEntry[];
  selectedEffect: EffectEntry | null;
  quests: QuestEntry[];
  selectedQuest: QuestEntry | null;
  achievements: AchievementEntry[];
  selectedAchievement: AchievementEntry | null;
  shops: ShopEntry[];
  items: ItemEntry[];

  // Cached data — actions
  lastReload: ReloadResult | null;
  lastBroadcast: BroadcastResult | null;

  // Polling
  lastRefreshed: Date | null;

  // Actions — connection
  setUrl: (url: string) => void;
  setToken: (token: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  loadConfig: (projectPath: string) => Promise<void>;
  saveConfig: (projectPath: string) => Promise<void>;

  // Actions — overview
  fetchOverview: () => Promise<void>;

  // Actions — players
  fetchPlayers: () => Promise<void>;
  fetchPlayerDetail: (name: string) => Promise<void>;
  clearSelectedPlayer: () => void;
  searchPlayer: (query: string) => Promise<void>;
  clearPlayerSearch: () => void;
  toggleStaff: (name: string) => Promise<StaffToggleResult | null>;

  // Actions — world
  fetchZones: () => Promise<void>;
  fetchZoneDetail: (zone: string) => Promise<void>;
  clearSelectedZone: () => void;
  fetchRoomDetail: (zone: string, room: string) => Promise<void>;
  clearSelectedRoom: () => void;
  fetchMobs: (zone?: string) => Promise<void>;
  fetchMobDetail: (id: string) => Promise<void>;
  clearSelectedMob: () => void;

  // Actions — content
  fetchAbilities: () => Promise<void>;
  fetchAbilityDetail: (id: string) => Promise<void>;
  clearSelectedAbility: () => void;
  fetchEffects: () => Promise<void>;
  fetchEffectDetail: (id: string) => Promise<void>;
  clearSelectedEffect: () => void;
  fetchQuests: () => Promise<void>;
  fetchQuestDetail: (id: string) => Promise<void>;
  clearSelectedQuest: () => void;
  fetchAchievements: () => Promise<void>;
  fetchAchievementDetail: (id: string) => Promise<void>;
  clearSelectedAchievement: () => void;
  fetchShops: () => Promise<void>;
  fetchItems: () => Promise<void>;

  // Actions — reload + broadcast
  reload: (target: ReloadTarget) => Promise<ReloadResult | null>;
  broadcast: (message: string) => Promise<BroadcastResult | null>;
}

// Helper to extract error message
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  url: "",
  token: "",
  connectionStatus: "disconnected",
  lastError: null,
  health: null,

  overview: null,

  players: [],
  selectedPlayer: null,
  playerSearchResults: null,

  zones: [],
  selectedZone: null,
  selectedRoom: null,
  mobs: [],
  selectedMob: null,

  abilities: [],
  selectedAbility: null,
  effects: [],
  selectedEffect: null,
  quests: [],
  selectedQuest: null,
  achievements: [],
  selectedAchievement: null,
  shops: [],
  items: [],

  lastReload: null,
  lastBroadcast: null,

  lastRefreshed: null,

  setUrl: (url) => set({ url }),
  setToken: (token) => set({ token }),

  connect: async () => {
    const { url, token } = get();
    if (!url || !token) {
      set({ connectionStatus: "error", lastError: "URL and token are required" });
      return;
    }
    set({ connectionStatus: "connecting", lastError: null });
    try {
      const health = await invoke<HealthResponse>("admin_health", { url, token });
      set({ connectionStatus: "connected", health, lastRefreshed: new Date() });
    } catch (err) {
      set({ connectionStatus: "error", lastError: errMsg(err) });
    }
  },

  disconnect: () =>
    set({
      connectionStatus: "disconnected",
      lastError: null,
      health: null,
      overview: null,
      players: [],
      selectedPlayer: null,
      playerSearchResults: null,
      zones: [],
      selectedZone: null,
      selectedRoom: null,
      mobs: [],
      selectedMob: null,
      abilities: [],
      selectedAbility: null,
      effects: [],
      selectedEffect: null,
      quests: [],
      selectedQuest: null,
      achievements: [],
      selectedAchievement: null,
      shops: [],
      items: [],
      lastReload: null,
      lastBroadcast: null,
      lastRefreshed: null,
    }),

  loadConfig: async (projectPath) => {
    try {
      const config = await invoke<AdminConfig>("load_admin_config", { projectPath });
      set({ url: config.url, token: config.token });
    } catch {
      // No config saved yet — leave defaults
    }
  },

  saveConfig: async (projectPath) => {
    const { url, token } = get();
    await invoke("save_admin_config", { projectPath, config: { url, token } });
  },

  // ─── Overview ──────────────────────────────────────────────────

  fetchOverview: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const overview = await invoke<AdminOverview>("admin_overview", { url, token });
      set({ overview, lastRefreshed: new Date() });
    } catch (err) {
      set({ connectionStatus: "error", lastError: errMsg(err) });
    }
  },

  // ─── Players ───────────────────────────────────────────────────

  fetchPlayers: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const players = await invoke<PlayerSummary[]>("admin_players", { url, token });
      set({ players, lastRefreshed: new Date() });
    } catch (err) {
      set({ connectionStatus: "error", lastError: errMsg(err) });
    }
  },

  fetchPlayerDetail: async (name) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<PlayerDetail>("admin_player_detail", { url, token, name });
      set({ selectedPlayer: detail });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  clearSelectedPlayer: () => set({ selectedPlayer: null }),

  searchPlayer: async (query) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const result = await invoke<PlayerDetail>("admin_player_search", { url, token, query });
      set({ playerSearchResults: result });
    } catch (err) {
      set({ lastError: errMsg(err), playerSearchResults: null });
    }
  },

  clearPlayerSearch: () => set({ playerSearchResults: null }),

  toggleStaff: async (name) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return null;
    try {
      const result = await invoke<StaffToggleResult>("admin_player_toggle_staff", { url, token, name });
      // Update selectedPlayer if it matches
      const { selectedPlayer } = get();
      if (selectedPlayer && selectedPlayer.name === name) {
        set({ selectedPlayer: { ...selectedPlayer, isStaff: result.isStaff } });
      }
      return result;
    } catch (err) {
      set({ lastError: errMsg(err) });
      return null;
    }
  },

  // ─── World ─────────────────────────────────────────────────────

  fetchZones: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const zones = await invoke<ZoneSummary[]>("admin_zones", { url, token });
      set({ zones, lastRefreshed: new Date() });
    } catch (err) {
      set({ connectionStatus: "error", lastError: errMsg(err) });
    }
  },

  fetchZoneDetail: async (zone) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<ZoneDetail>("admin_zone_detail", { url, token, zone });
      set({ selectedZone: detail });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  clearSelectedZone: () => set({ selectedZone: null, selectedRoom: null }),

  fetchRoomDetail: async (zone, room) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<RoomDetailResponse>("admin_room_detail", { url, token, zone, room });
      set({ selectedRoom: detail });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  clearSelectedRoom: () => set({ selectedRoom: null }),

  fetchMobs: async (zone) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const mobs = await invoke<MobSummary[]>("admin_mobs", { url, token, zone: zone ?? null });
      set({ mobs, lastRefreshed: new Date() });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  fetchMobDetail: async (id) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const mob = await invoke<MobSummary>("admin_mob_detail", { url, token, id });
      set({ selectedMob: mob });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  clearSelectedMob: () => set({ selectedMob: null }),

  // ─── Content ───────────────────────────────────────────────────

  fetchAbilities: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const abilities = await invoke<AbilityEntry[]>("admin_abilities", { url, token });
      set({ abilities });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  fetchAbilityDetail: async (id) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<AbilityEntry>("admin_ability_detail", { url, token, id });
      set({ selectedAbility: detail });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  clearSelectedAbility: () => set({ selectedAbility: null }),

  fetchEffects: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const effects = await invoke<EffectEntry[]>("admin_effects", { url, token });
      set({ effects });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  fetchEffectDetail: async (id) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<EffectEntry>("admin_effect_detail", { url, token, id });
      set({ selectedEffect: detail });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  clearSelectedEffect: () => set({ selectedEffect: null }),

  fetchQuests: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const quests = await invoke<QuestEntry[]>("admin_quests", { url, token });
      set({ quests });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  fetchQuestDetail: async (id) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<QuestEntry>("admin_quest_detail", { url, token, id });
      set({ selectedQuest: detail });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  clearSelectedQuest: () => set({ selectedQuest: null }),

  fetchAchievements: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const achievements = await invoke<AchievementEntry[]>("admin_achievements", { url, token });
      set({ achievements });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  fetchAchievementDetail: async (id) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<AchievementEntry>("admin_achievement_detail", { url, token, id });
      set({ selectedAchievement: detail });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  clearSelectedAchievement: () => set({ selectedAchievement: null }),

  fetchShops: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const shops = await invoke<ShopEntry[]>("admin_shops", { url, token });
      set({ shops });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  fetchItems: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const items = await invoke<ItemEntry[]>("admin_items", { url, token });
      set({ items });
    } catch (err) {
      set({ lastError: errMsg(err) });
    }
  },

  // ─── Actions ───────────────────────────────────────────────────

  reload: async (target) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return null;
    try {
      const result = await invoke<ReloadResult>("admin_reload", { url, token, target });
      set({ lastReload: result });
      return result;
    } catch (err) {
      set({ lastError: errMsg(err) });
      return null;
    }
  },

  broadcast: async (message) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return null;
    try {
      const result = await invoke<BroadcastResult>("admin_broadcast", { url, token, message });
      set({ lastBroadcast: result });
      return result;
    } catch (err) {
      set({ lastError: errMsg(err) });
      return null;
    }
  },
}));

// ─── Polling manager ───────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;
let currentPollView: string | null = null;

export function startAdminPolling(view: string) {
  stopAdminPolling();
  currentPollView = view;

  const tick = () => {
    const store = useAdminStore.getState();
    if (store.connectionStatus !== "connected") return;
    switch (currentPollView) {
      case "overview":
        store.fetchOverview();
        break;
      case "players":
        store.fetchPlayers();
        break;
      case "world":
        store.fetchZones();
        break;
      // "content" and "actions" don't need polling — fetched on mount
    }
  };

  // Immediate first fetch
  tick();
  pollTimer = setInterval(tick, POLL_INTERVAL);
}

export function stopAdminPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  currentPollView = null;
}
