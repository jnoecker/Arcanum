import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  PRESET_THEMES,
  contrastRatio,
  rgbTuple,
  themeToVars,
} from "@/lib/theme";

describe("themeToVars", () => {
  it("keeps the default palette in dark mode", () => {
    const vars = themeToVars(DEFAULT_THEME);

    expect(vars["--theme-mode"]).toBe("dark");
    expect(vars["--shadow-rgb"]).toBe("0 0 0");
    expect(vars["--overlay-rgb"]).toBe(rgbTuple(vars["--color-bg-abyss"]));
    expect(vars["--color-text-on-accent"]).toBe(DEFAULT_THEME.background);
  });

  it("derives stronger shadows and overlays for light themes", () => {
    const parchment = PRESET_THEMES.find((theme) => theme.name === "Parchment (light)");
    expect(parchment).toBeDefined();

    const vars = themeToVars(parchment!);

    expect(vars["--theme-mode"]).toBe("light");
    expect(vars["--shadow-rgb"]).toBe(rgbTuple(parchment!.text));
    expect(vars["--overlay-rgb"]).toBe(rgbTuple(parchment!.text));
    expect(vars["--fill-rgb"]).not.toBe("255 255 255");
    expect(vars["--color-text-on-accent"]).toBe(parchment!.background);
  });
});

describe("contrastRatio", () => {
  it("reports strong contrast for the default text/background pair", () => {
    expect(contrastRatio(DEFAULT_THEME.background, DEFAULT_THEME.text)).toBeGreaterThan(9);
  });
});
