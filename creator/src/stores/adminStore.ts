import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  AdminConfig,
  AdminConnectionStatus,
  AdminOverview,
  PlayerSummary,
  PlayerDetail,
  ZoneSummary,
  ZoneDetail,
  ReloadResult,
  ReloadTarget,
} from "@/types/admin";

const POLL_INTERVAL = 10_000; // 10 seconds

interface AdminStore {
  // Connection
  url: string;
  token: string;
  connectionStatus: AdminConnectionStatus;
  lastError: string | null;

  // Cached data
  overview: AdminOverview | null;
  players: PlayerSummary[];
  zones: ZoneSummary[];
  selectedPlayer: PlayerDetail | null;
  selectedZone: ZoneDetail | null;
  lastReload: ReloadResult | null;

  // Polling
  lastRefreshed: Date | null;

  // Actions — connection
  setUrl: (url: string) => void;
  setToken: (token: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  loadConfig: (projectPath: string) => Promise<void>;
  saveConfig: (projectPath: string) => Promise<void>;

  // Actions — data fetching
  fetchOverview: () => Promise<void>;
  fetchPlayers: () => Promise<void>;
  fetchPlayerDetail: (name: string) => Promise<void>;
  clearSelectedPlayer: () => void;
  fetchZones: () => Promise<void>;
  fetchZoneDetail: (zone: string) => Promise<void>;
  clearSelectedZone: () => void;
  reload: (target: ReloadTarget) => Promise<ReloadResult | null>;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  url: "",
  token: "",
  connectionStatus: "disconnected",
  lastError: null,

  overview: null,
  players: [],
  zones: [],
  selectedPlayer: null,
  selectedZone: null,
  lastReload: null,

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
      const overview = await invoke<AdminOverview>("admin_overview", { url, token });
      set({ connectionStatus: "connected", overview, lastRefreshed: new Date() });
    } catch (err) {
      set({
        connectionStatus: "error",
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  disconnect: () =>
    set({
      connectionStatus: "disconnected",
      lastError: null,
      overview: null,
      players: [],
      zones: [],
      selectedPlayer: null,
      selectedZone: null,
      lastReload: null,
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
    await invoke("save_admin_config", {
      projectPath,
      config: { url, token },
    });
  },

  fetchOverview: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const overview = await invoke<AdminOverview>("admin_overview", { url, token });
      set({ overview, lastRefreshed: new Date() });
    } catch (err) {
      set({
        connectionStatus: "error",
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  fetchPlayers: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const players = await invoke<PlayerSummary[]>("admin_players", { url, token });
      set({ players, lastRefreshed: new Date() });
    } catch (err) {
      set({
        connectionStatus: "error",
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  fetchPlayerDetail: async (name) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<PlayerDetail>("admin_player_detail", { url, token, name });
      set({ selectedPlayer: detail });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  clearSelectedPlayer: () => set({ selectedPlayer: null }),

  fetchZones: async () => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const zones = await invoke<ZoneSummary[]>("admin_zones", { url, token });
      set({ zones, lastRefreshed: new Date() });
    } catch (err) {
      set({
        connectionStatus: "error",
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  fetchZoneDetail: async (zone) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return;
    try {
      const detail = await invoke<ZoneDetail>("admin_zone_detail", { url, token, zone });
      set({ selectedZone: detail });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  clearSelectedZone: () => set({ selectedZone: null }),

  reload: async (target) => {
    const { url, token, connectionStatus } = get();
    if (connectionStatus !== "connected") return null;
    try {
      const result = await invoke<ReloadResult>("admin_reload", { url, token, target });
      set({ lastReload: result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
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
      case "zones":
        store.fetchZones();
        break;
      // "actions" doesn't need polling
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
