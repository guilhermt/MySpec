import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { renderWithStore } from "@/test/render";

/** The rule that keeps dialogs on whole pixels, at the top level of globals.css. */
const PIXEL_SNAP_RULE = `
[data-slot="dialog-content"],
[data-slot="alert-dialog-content"] {
  top: round(50%, 1px);
  left: round(50%, 1px);
  translate: round(-50%, 1px) round(-50%, 1px);
}
`;

/** The centring the rule rounds, as the generated components write it. */
const CENTRING = ["-translate-x-1/2", "-translate-y-1/2", "left-1/2", "top-1/2"];

/** Utilities that place an element, whatever their variant: offsets, insets, translates, margins. */
const PLACEMENT = /^-?(inset|top|right|bottom|left|start|end|translate|m[xytrblse]?)(-|$)/;

function placementClasses(element: Element): string[] {
  return [...element.classList]
    .filter((name) => PLACEMENT.test(name.slice(name.lastIndexOf(":") + 1)))
    .sort();
}

describe("globals.css", () => {
  it("rounds the centring of dialogs to whole pixels, outside any layer", () => {
    const css = readFileSync(join(import.meta.dirname, "globals.css"), "utf8");

    expect(css).toContain(PIXEL_SNAP_RULE);
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
