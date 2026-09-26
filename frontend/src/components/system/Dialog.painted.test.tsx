import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { Button } from "./Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter, type DialogProps } from "./Dialog";

function Subject(props: Partial<DialogProps>) {
  return (
    <Dialog open onOpenChange={() => {}} title="Delete the task" {...props}>
      <DialogBody>The worktree is removed.</DialogBody>
      <DialogFooter>
        <Button>Cancel</Button>
        <Button variant="danger">Delete</Button>
      </DialogFooter>
    </Dialog>
  );
}

describe.each(THEMES)("Dialog in the %s theme", (theme) => {
  it.each([
    ["dialog", false],
    ["alertdialog", true],
  ] as const)("paints the %s sheet on the top surface with the overlay shadow", (role, alert) => {
    setTheme(theme);
    render(<Subject {...(alert ? { alert } : {})} />);
    const sheet = screen.getByRole(role, { name: "Delete the task" });
    const want = {
      background: token("--surface-3"),
      color: token("--ink-1"),
      shadow: resolve("var(--shadow-overlay)", "box-shadow"),
    };
    expect(paintOf(sheet, want)).toEqual(want);
    expect(getComputedStyle(sheet).borderTopLeftRadius).toBe(
      resolve("var(--radius-xl)", "border-top-left-radius"),
    );
    // The layout width: the rect would carry the scale of the opening animation.
    expect(`${sheet.offsetWidth}px`).toBe(resolve("var(--size-dialog)", "width"));
  });

  it("widens with the wide size", () => {
    setTheme(theme);
    render(<Subject size="wide" />);
    const sheet = screen.getByRole("dialog", { name: "Delete the task" });
    expect(`${sheet.offsetWidth}px`).toBe(resolve("var(--size-dialog-wide)", "width"));
  });

  it("sinks the footer", () => {
    setTheme(theme);
    render(<Subject />);
    const footer = screen.getByRole("button", { name: "Cancel" }).parentElement;
    expect(footer).not.toBeNull();
    if (footer !== null) {
      expect(paintOf(footer, { background: "" })).toEqual({ background: token("--surface-0") });
    }
  });

  it("lays the scrim behind it, without blur", () => {
    setTheme(theme);
    render(<Subject />);
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    expect(backdrop).not.toBeNull();
    if (backdrop !== null) {
      expect(paintOf(backdrop, { background: "" })).toEqual({ background: token("--scrim") });
      expect(getComputedStyle(backdrop).backdropFilter).toBe("none");
    }
  });
});

/** Opened is an alert dialog behind the button that opens it. */
function Opened() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Delete…</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Delete the task" alert>
        <DialogBody>The worktree is removed.</DialogBody>
        <DialogFooter>
          <DialogCancel />
          <Button variant="danger">Delete</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

describe("Dialog in the browser", () => {
  it("opens an alert with the pointer on Cancel, with no tooltip", async () => {
    render(<Opened />);
    await userEvent.click(screen.getByRole("button", { name: "Delete…" }));
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await expect.poll(() => document.activeElement).toBe(cancel);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("names the close button in a tooltip when the keyboard reaches it", async () => {
    render(<Opened />);
    await userEvent.click(screen.getByRole("button", { name: "Delete…" }));
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await expect.poll(() => document.activeElement).toBe(cancel);
    // The focus is held in the dialog: from the last button, Tab wraps to the close button.
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    await expect.poll(() => screen.queryByRole("tooltip")?.textContent).toBe("CloseEsc");
  });
});
