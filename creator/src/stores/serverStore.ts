import { create } from "zustand";
import type { ServerStatus } from "@/types/project";

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "STDOUT";
  text: string;
}

interface ServerStore {
  status: ServerStatus;
  pid: number | null;
  lastError: string | null;
  logs: LogEntry[];
  nextLogId: number;

  setStatus: (status: ServerStatus) => void;
  setPid: (pid: number | null) => void;
  setLastError: (error: string | null) => void;
  addLog: (level: LogEntry["level"], text: string) => void;
  clearLogs: () => void;
}

function parseLogLevel(text: string): LogEntry["level"] {
  if (text.includes(" DEBUG ")) return "DEBUG";
  if (text.includes(" INFO ")) return "INFO";
  if (text.includes(" WARN ")) return "WARN";
  if (text.includes(" ERROR ")) return "ERROR";
  return "STDOUT";
}

export const useServerStore = create<ServerStore>((set, get) => ({
  status: "stopped",
  pid: null,
  lastError: null,
  logs: [],
  nextLogId: 1,

  setStatus: (status) => set({ status }),
  setPid: (pid) => set({ pid }),
  setLastError: (error) => set({ lastError: error }),

  addLog: (level, text) => {
    const { nextLogId } = get();
    const detectedLevel = level === "STDOUT" ? parseLogLevel(text) : level;
    set((state) => ({
      logs: [
        ...state.logs,
        { id: nextLogId, timestamp: new Date(), level: detectedLevel, text },
      ],
      nextLogId: nextLogId + 1,
    }));
  },

  clearLogs: () => set({ logs: [], nextLogId: 1 }),
}));
