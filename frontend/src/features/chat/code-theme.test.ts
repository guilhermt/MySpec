import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CODE_THEMES } from "@/features/chat/code-theme";

// Vitest runs with css: false, so the tokens are read as text.
const TOKENS = readFileSync(
  join(import.meta.dirname, "../../../../design/system/tokens.css"),
  "utf8",
);

interface TokenColor {
  settings: { foreground: string; fontStyle?: string };
}

function colours(theme: (typeof CODE_THEMES)[number]): string[] {
  const tokenColors = (theme.tokenColors ?? []) as TokenColor[];
  return [
    ...Object.values(theme.colors ?? {}),
    theme.fg ?? "",
    theme.bg ?? "",
    ...tokenColors.map((item) => item.settings.foreground),
  ];
}

describe("CODE_THEMES", () => {
  it("names a light and a dark theme", () => {
    expect(CODE_THEMES.map((theme) => [theme.name, theme.type])).toEqual([
      ["myspec-light", "light"],
      ["myspec-dark", "dark"],
    ]);
  });

  it("paints only with tokens of the design system", () => {
    for (const theme of CODE_THEMES) {
      for (const colour of colours(theme)) {
        const token = /^var\((--[\w-]+)\)$/.exec(colour)?.[1];
        expect(token, colour).toBeDefined();
        expect(TOKENS, colour).toMatch(new RegExp(`${token}:`));
      }
    }
  });

  it("gives each code token of the system its hue", () => {
    for (const theme of CODE_THEMES) {
      const hues = colours(theme);
      for (const token of ["keyword", "string", "function", "number", "comment"]) {
        expect(hues).toContain(`var(--code-${token})`);
      }
    }
  });

  it("sets every token in the regular weight, without italic or bold", () => {
    for (const theme of CODE_THEMES) {
      const tokenColors = (theme.tokenColors ?? []) as TokenColor[];
      expect(tokenColors.length).toBeGreaterThan(0);
      for (const item of tokenColors) {
        expect(item.settings, item.settings.foreground).not.toHaveProperty("fontStyle");
      }
    }
  });
});
