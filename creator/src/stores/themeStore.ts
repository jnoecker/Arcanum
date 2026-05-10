import { create } from "zustand";
import {
  DEFAULT_THEME,
  applyTheme,
  clearTheme,
  loadStoredTheme,
  saveStoredTheme,
  loadStoredPanelBackgrounds,
  saveStoredPanelBackgrounds,
  type ThemePalette,
} from "@/lib/theme";

interface ThemeStore {
  /** The currently applied theme. Null means "use index.css defaults". */
  theme: ThemePalette | null;
  /** Whether atmospheric panel/dialog background images should render. Disabling
   *  removes them everywhere for accessibility (reduces visual noise without
   *  affecting island-map navigation). */
  panelBackgrounds: boolean;
  /** Set and persist a custom theme. Pass null to revert to defaults. */
  setTheme: (theme: ThemePalette | null) => void;
  /** Live-preview a theme without persisting it. */
  previewTheme: (theme: ThemePalette) => void;
  /** Cancel an in-progress preview and re-apply the persisted theme. */
  cancelPreview: () => void;
  /** Toggle atmospheric backgrounds. */
  setPanelBackgrounds: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: null,
  panelBackgrounds: true,

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

  setPanelBackgrounds: (enabled) => {
    saveStoredPanelBackgrounds(enabled);
    set({ panelBackgrounds: enabled });
  },
}));

/**
 * Read the persisted theme + atmospheric prefs from localStorage and apply.
 * Call once at app startup before first paint to avoid a flash of defaults.
 */
export function bootstrapTheme(): void {
  const stored = loadStoredTheme();
  if (stored) {
    applyTheme(stored);
    useThemeStore.setState({ theme: stored });
  }
  useThemeStore.setState({ panelBackgrounds: loadStoredPanelBackgrounds() });
}

export { DEFAULT_THEME };
