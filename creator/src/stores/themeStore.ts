import { create } from "zustand";
import {
  DEFAULT_THEME,
  applyTheme,
  clearTheme,
  loadStoredTheme,
  saveStoredTheme,
  type ThemePalette,
} from "@/lib/theme";

interface ThemeStore {
  /** The currently applied theme. Null means "use index.css defaults". */
  theme: ThemePalette | null;
  /** Set and persist a custom theme. Pass null to revert to defaults. */
  setTheme: (theme: ThemePalette | null) => void;
  /** Live-preview a theme without persisting it. */
  previewTheme: (theme: ThemePalette) => void;
  /** Cancel an in-progress preview and re-apply the persisted theme. */
  cancelPreview: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: null,

  setTheme: (theme) => {
    if (theme === null) {
      clearTheme();
    } else {
      applyTheme(theme);
    }
    saveStoredTheme(theme);
    set({ theme });
  },

  previewTheme: (theme) => {
    applyTheme(theme);
  },

  cancelPreview: () => {
    const persisted = get().theme;
    if (persisted === null) {
      clearTheme();
    } else {
      applyTheme(persisted);
    }
  },
}));

/**
 * Read the persisted theme from localStorage and apply it. Call once at app
 * startup before first paint to avoid a flash of the default theme.
 */
export function bootstrapTheme(): void {
  const stored = loadStoredTheme();
  if (stored) {
    applyTheme(stored);
    useThemeStore.setState({ theme: stored });
  }
}

export { DEFAULT_THEME };
