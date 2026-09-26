import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

/** Tokens measured in em, which follow the text they sit in instead of the pixel grid. */
const EM_TOKENS = ["--link-offset", "--tracking-caps"];

/** The prefixes of the layout widths, which may depend on the window. */
const LAYOUT_WIDTHS = /^--(sidebar-|panel-|measure|list-|size-|col-|snav-)/;

/** Layout widths still unrounded: task 2 rounds them, with the panels that use them. */
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

  it("paints no literal colour outside the tokens", () => {
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
      return /oklch\(|rgba?\(|hsla?\(/.test(text) || /["'`[]#[0-9a-fA-F]{3,8}["'`\]]/.test(text);
    });

    expect(files.length).toBeGreaterThan(0);
    expect(painted).toEqual([]);
  });

  it("draws every icon with the stroke of the system", () => {
    expect(GLOBALS).toContain(ICON_RULE);
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
