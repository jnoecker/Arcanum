import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ─── Types ─────────────────────────────────────────────────────────

export interface RepoStatus {
  is_repo: boolean;
  branch: string;
  changed_files: number;
  ahead: number;
  behind: number;
  has_remote: boolean;
  remote_url: string;
}

export interface CommitInfo {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
}

export interface PullResult {
  success: boolean;
  had_conflicts: boolean;
  summary: string;
}

export interface PrResult {
  pr_url: string;
  branch_name: string;
}

// ─── Store ─────────────────────────────────────────────────────────

interface GitStore {
  status: RepoStatus | null;
  log: CommitInfo[];

  loading: boolean;
  committing: boolean;
  pushing: boolean;
  pulling: boolean;
  initializing: boolean;

  lastError: string | null;
  lastSuccess: string | null;
  pullResult: PullResult | null;
  prResult: PrResult | null;

  refreshStatus: (path: string) => Promise<void>;
  refreshLog: (path: string, count?: number) => Promise<void>;
  initRepo: (path: string) => Promise<void>;
  setRemote: (path: string, url: string) => Promise<void>;
  commit: (path: string, message: string) => Promise<void>;
  push: (path: string) => Promise<void>;
  pull: (path: string) => Promise<void>;
  abortMerge: (path: string) => Promise<void>;
  createPr: (path: string, branchName: string, title: string, body: string) => Promise<void>;
  clearMessages: () => void;
}

export const useGitStore = create<GitStore>((set, get) => ({
  status: null,
  log: [],

  loading: false,
  committing: false,
  pushing: false,
  pulling: false,
  initializing: false,

  lastError: null,
  lastSuccess: null,
  pullResult: null,
  prResult: null,

  refreshStatus: async (path) => {
    set({ loading: true });
    try {
      const status = await invoke<RepoStatus>("git_repo_status", { path });
      set({ status, loading: false });
    } catch (e) {
      set({ loading: false, lastError: String(e) });
    }
  },

  refreshLog: async (path, count = 20) => {
    try {
      const log = await invoke<CommitInfo[]>("git_log", { path, count });
      set({ log });
    } catch {
      set({ log: [] });
    }
  },

  initRepo: async (path) => {
    set({ initializing: true, lastError: null, lastSuccess: null });
    try {
      const result = await invoke<string>("git_init", { path });
      set({ initializing: false, lastSuccess: result });
      await get().refreshStatus(path);
      await get().refreshLog(path);
    } catch (e) {
      set({ initializing: false, lastError: String(e) });
    }
  },

  setRemote: async (path, url) => {
    set({ lastError: null, lastSuccess: null });
    try {
      await invoke("git_set_remote", { path, url });
      set({ lastSuccess: "Remote configured" });
      await get().refreshStatus(path);
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  commit: async (path, message) => {
    set({ committing: true, lastError: null, lastSuccess: null });
    try {
      const result = await invoke<string>("git_commit", { path, message });
      set({ committing: false, lastSuccess: result });
      await get().refreshStatus(path);
      await get().refreshLog(path);
    } catch (e) {
      set({ committing: false, lastError: String(e) });
    }
  },

  push: async (path) => {
    set({ pushing: true, lastError: null, lastSuccess: null });
    try {
      const result = await invoke<string>("git_push", { path });
      set({ pushing: false, lastSuccess: result });
      await get().refreshStatus(path);
    } catch (e) {
      set({ pushing: false, lastError: String(e) });
    }
  },

  pull: async (path) => {
    set({ pulling: true, lastError: null, lastSuccess: null, pullResult: null });
    try {
      const result = await invoke<PullResult>("git_pull", { path });
      set({
        pulling: false,
        pullResult: result,
        lastSuccess: result.success ? result.summary : null,
        lastError: result.had_conflicts ? result.summary : null,
      });
      await get().refreshStatus(path);
      await get().refreshLog(path);
    } catch (e) {
      set({ pulling: false, lastError: String(e) });
    }
  },

  abortMerge: async (path) => {
    try {
      await invoke("git_abort_merge", { path });
      await get().refreshStatus(path);
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  createPr: async (path, branchName, title, body) => {
    set({ lastError: null, lastSuccess: null, prResult: null });
    try {
      const result = await invoke<PrResult>("git_create_pr", {
        path,
        branchName,
        title,
        body,
      });
      set({ prResult: result, lastSuccess: `PR created: ${result.pr_url}`, pullResult: null });
      await get().refreshStatus(path);
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  clearMessages: () => set({ lastError: null, lastSuccess: null, pullResult: null, prResult: null }),
}));
