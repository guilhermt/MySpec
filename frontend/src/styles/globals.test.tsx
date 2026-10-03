import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AUX_PANEL_COLUMN_MIN } from "@/components/system/AuxPanel";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { renderWithStore } from "@/test/render";

// Vitest runs with css: false, so the stylesheets are read as text.
const STYLES = import.meta.dirname;
const GLOBALS = readFileSync(join(STYLES, "globals.css"), "utf8");
const TOKENS_PATH = join(STYLES, "../../../design/system/tokens.css");
const TOKENS = readFileSync(TOKENS_PATH, "utf8");

/** The rule that opens dialogs 8vh from the top on whole pixels, at the top level of globals.css. */
const PIXEL_SNAP_RULE = `
[data-slot="dialog-content"],
[data-slot="alert-dialog-content"] {
  top: round(8vh, 1px);
  left: round(50%, 1px);
  translate: round(-50%, 1px) 0;
}
`;

/** The rule that veils the app under a dialog, at the top level of globals.css. */
const SCRIM_RULE = `
[data-slot="dialog-overlay"],
[data-slot="alert-dialog-overlay"] {
  background: var(--scrim);
  backdrop-filter: none;
}
`;

/** The rule that gives every icon the stroke of the system, at the top level of globals.css. */
const ICON_RULE = `
svg.lucide {
  stroke-width: var(--icon-stroke);
}
`;

/** The centring the rule rounds, as the generated components write it. */
const CENTRING = ["-translate-x-1/2", "-translate-y-1/2", "left-1/2", "top-1/2"];

/** Utilities that place an element, whatever their variant: offsets, insets, translates, margins. */
const PLACEMENT = /^-?(inset|top|right|bottom|left|start|end|translate|m[xytrblse]?)(-|$)/;

/**
 * TAILWIND_PALETTE matches a class that paints with a colour of the Tailwind palette (text-red-500,
 * bg-amber-100/50, fill-white), which reads the oklch of the Tailwind theme instead of a token.
 */
const TAILWIND_PALETTE =
  /(?:^|[\s"'`:])(?:bg|text|border(?:-[trblxyse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|shadow|inset-shadow|accent|caret|placeholder)-(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe)-\d{2,3}|black|white)(?:\/\d+)?(?=$|[\s"'`])/;

/** Tokens measured in em, which follow the text they sit in instead of the pixel grid. */
const EM_TOKENS = ["--link-offset", "--tracking-caps"];

/** The prefixes of the layout widths, which may depend on the window. */
const LAYOUT_WIDTHS = /^--(sidebar-|panel-|measure|list-|size-|col-|snav-)/;

/** Layout widths rounded where they are used, not in the token. */
const UNROUNDED_WIDTHS = ["--panel-width", "--panel-card-width"];

function placementClasses(element: Element): string[] {
  return [...element.classList]
    .filter((name) => PLACEMENT.test(name.slice(name.lastIndexOf(":") + 1)))
    .sort();
}

/** Every custom property declared in css, without comments; the last value of a name wins. */
function declarations(css: string): Map<string, string> {
  const found = new Map<string, string>();
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, name, value] of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    if (name !== undefined && value !== undefined) {
      found.set(name, value.trim());
    }
  }
  return found;
}

/** The body of the @theme inline block of css. */
function themeInline(css: string): string {
  return /@theme inline \{([^}]*)\}/.exec(css)?.[1] ?? "";
}

/** The variable a value reads when it is exactly var(--name), or undefined. */
function target(value: string | undefined): string | undefined {
  return value === undefined ? undefined : /^var\((--[\w-]+)\)$/.exec(value)?.[1];
}

/** The pixels of a length in rem or px, on the 16px root. */
function pixels(value: string): number {
  return Number.parseFloat(value) * (value.endsWith("rem") ? 16 : 1);
}

describe("globals.css", () => {
  const tokens = declarations(TOKENS);
  const bridge = declarations(GLOBALS.replace(themeInline(GLOBALS), ""));

  it("takes the tokens from the design system, their single source", () => {
    expect(GLOBALS).toContain('@import "../../../design/system/tokens.css";');
    expect(existsSync(TOKENS_PATH)).toBe(true);
  });

  it("gives the generated components no value of their own, only tokens", () => {
    // A local variable of a rule, like the flash colour, may read a token through the bridge.
    const own = [...bridge].filter(([, value]) => {
      const name = target(value);
      return (
        name === undefined || !(tokens.has(name) || tokens.has(target(bridge.get(name)) ?? ""))
      );
    });

    expect(bridge.size).toBeGreaterThan(0);
    expect(own).toEqual([]);
  });

  it("points every theme entry at a token or at the bridge", () => {
    const entries = declarations(themeInline(GLOBALS));
    const loose = [...entries].filter(([, value]) => {
      const name = target(value);
      return name === undefined || !(tokens.has(name) || bridge.has(name));
    });

    expect(entries.size).toBeGreaterThan(0);
    expect(loose).toEqual([]);
  });

  it("keeps every size of the tokens on whole pixels", () => {
    const halves = [...tokens].filter(
      ([name, value]) =>
        !EM_TOKENS.includes(name) &&
        [...value.matchAll(/(\d*\.?\d+)(rem|px)\b/g)].some(
          ([length]) => !Number.isInteger(pixels(length)),
        ),
    );

    expect(halves).toEqual([]);
  });

  it("sizes the Placeholders column of the prompt editor in whole pixels, 224px", () => {
    const value = tokens.get("--col-placeholders") ?? "";
    const space = (name: string) => pixels(tokens.get(name) ?? "");
    const product = /^calc\(var\((--space-\d+)\) \* (\d+(?:\.\d+)?)\)$/.exec(value);

    expect(product, value).not.toBeNull();
    expect(space(product?.[1] ?? "") * Number(product?.[2])).toBe(224);
  });

  it("rounds every layout width that depends on the window", () => {
    const unrounded = [...tokens].filter(
      ([name, value]) =>
        LAYOUT_WIDTHS.test(name) &&
        !UNROUNDED_WIDTHS.includes(name) &&
        /%|vw/.test(value) &&
        !value.includes("round("),
    );

    expect(unrounded).toEqual([]);
  });

  it("sizes the state glyphs in even pixels, so they centre on a whole pixel", () => {
    for (const name of ["--glyph", "--glyph-sm", "--glyph-diamond"]) {
      const value = tokens.get(name);

      expect(value, name).toBeDefined();
      expect(pixels(value ?? "") % 2, name).toBe(0);
    }
  });

  it("paints no literal colour outside the tokens, nor a colour of the Tailwind palette", () => {
    const src = join(STYLES, "..");
    const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
      (path) =>
        /\.(css|tsx?)$/.test(path) &&
        !path.startsWith("components/ui/") &&
        // The test helpers name computed values to compare with, and paint nothing.
        !path.startsWith("test/") &&
        !/\.test\./.test(path),
    );
    const painted = files.filter((path) => {
      const text = readFileSync(join(src, path), "utf8");
      if (path.endsWith(".css")) {
        return /oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/.test(text);
      }
      return (
        /oklch\(|rgba?\(|hsla?\(/.test(text) ||
        /["'`[]#[0-9a-fA-F]{3,8}["'`\]]/.test(text) ||
        TAILWIND_PALETTE.test(text)
      );
    });

    expect(files.length).toBeGreaterThan(0);
    expect(painted).toEqual([]);
  });

  it("recognises a colour of the Tailwind palette in a class", () => {
    for (const painted of [
      "text-red-500",
      "bg-amber-100/50",
      "hover:border-slate-200",
      "fill-white",
    ]) {
      expect(TAILWIND_PALETTE.test(`className="${painted}"`), painted).toBe(true);
    }
    for (const system of ["text-ink-3", "bg-state-error-veil", "text-red-ish", "border-line-2"]) {
      expect(TAILWIND_PALETTE.test(`className="${system}"`), system).toBe(false);
    }
  });

  it("draws every icon with the stroke of the system", () => {
    expect(GLOBALS).toContain(ICON_RULE);
  });

  it("rounds the width of the auxiliary panel to the pixel", () => {
    expect(GLOBALS).toMatch(/\.aux-panel \{[^}]*width: round\(down, var\(--panel-width\), 1px\);/);
  });

  it("puts the panel beside the column from 1120px of main area", () => {
    expect(GLOBALS).toContain(".main-area {\n    container: main / inline-size;\n  }");
    expect(GLOBALS).toMatch(
      /@container main \(min-width: 1120px\) \{\s*\.aux-panel \{\s*position: relative;/,
    );
  });

  it("measures the panel beside the column from the width the stylesheet puts it there", () => {
    expect(GLOBALS).toContain(`@container main (min-width: ${AUX_PANEL_COLUMN_MIN}px) {`);
  });

  it("centers the pair of Settings at a whole pixel, with the page at --measure", () => {
    expect(GLOBALS).toMatch(
      /\.settings-body \{[^}]*max-width: calc\(var\(--snav-w\) \+ var\(--space-12\) \+ var\(--measure\) \+ 2 \* var\(--space-6\)\);[^}]*margin-left: max\(\s*0px,\s*round\(\s*down,\s*calc\(\(100% - var\(--snav-w\) - var\(--space-12\) - var\(--measure\) - 2 \* var\(--space-6\)\) \/ 2\),\s*1px\s*\)\s*\);/,
    );
    expect(GLOBALS).toMatch(
      /@container main \(max-width: 820px\) \{\s*\.settings-body \{[^}]*grid-template-columns: minmax\(0, var\(--measure\)\);/,
    );
  });

  it("rounds the width of the list panel and puts it beside the list from 800px of main area", () => {
    expect(GLOBALS).toMatch(
      /\.list-panel \{[^}]*width: round\(down, var\(--panel-card-width\), 1px\);/,
    );
    expect(GLOBALS).toMatch(
      /@container main \(min-width: 800px\) \{\s*\.list-panel \{\s*position: relative;/,
    );
    expect(GLOBALS).toContain(
      "[data-leaving] > .list-panel {\n    animation: aux-panel-exit var(--duration-fast) var(--ease-exit) forwards;",
    );
  });

  it("blinks a new situation twice for --duration-slow, and never with reduced motion", () => {
    expect(GLOBALS).toContain(
      "animation: situation-flash var(--duration-slow) var(--ease-standard) 2;",
    );
    const reduced = [
      ...GLOBALS.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g),
    ]
      .map((match) => match[1] ?? "")
      .join("\n");
    expect(reduced).toMatch(/\.situation-flash\[data-flash\] \{\s*animation: none;\s*\}/);
    expect(GLOBALS).not.toContain("attention-flash");
  });

  it("takes the panel and the toast away in --duration-fast with the exit curve", () => {
    expect(GLOBALS).toContain(
      "[data-leaving] > .aux-panel {\n    animation: aux-panel-exit var(--duration-fast) var(--ease-exit) forwards;",
    );
    expect(GLOBALS).toContain(
      ".toast[data-leaving] {\n    animation: toast-exit var(--duration-fast) var(--ease-exit) forwards;",
    );
  });

  it("places dialogs 8vh from the top, on whole pixels, outside any layer", () => {
    expect(GLOBALS).toContain(PIXEL_SNAP_RULE);
  });

  it("veils the app under a dialog with the scrim, without blur", () => {
    expect(GLOBALS).toContain(SCRIM_RULE);
  });

  it("matches the slots of the dialog overlays", () => {
    renderWithStore(
      <>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      </>,
    );

    expect(document.body.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull();
    expect(document.body.querySelector('[data-slot="alert-dialog-overlay"]')).not.toBeNull();
  });

  it("matches how DialogContent is placed", () => {
    renderWithStore(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-slot", "dialog-content");
    expect(placementClasses(dialog)).toEqual(CENTRING);
  });

  it("matches how AlertDialogContent is placed", () => {
    renderWithStore(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("data-slot", "alert-dialog-content");
    expect(placementClasses(dialog)).toEqual(CENTRING);
  });
});
