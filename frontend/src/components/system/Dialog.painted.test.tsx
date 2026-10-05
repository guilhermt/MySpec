import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  dashedDisabled,
  paintOf,
  resolve,
  setTheme,
  THEMES,
  TRANSPARENT,
  token,
} from "@/test/painted";
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

  it("keeps --space-8 free in a narrow window", async () => {
    setTheme(theme);
    await page.viewport(400, 700);
    try {
      render(<Subject />);
      const sheet = screen.getByRole("dialog", { name: "Delete the task" });
      const free = Number.parseFloat(resolve("var(--space-8)", "width"));
      expect(sheet.offsetWidth).toBe(window.innerWidth - free);
    } finally {
      await page.viewport(1280, 800);
    }
  });

  it("keeps --space-8 free on every side of the full size, in a window of 1080 px", async () => {
    setTheme(theme);
    await page.viewport(1920, 1080);
    try {
      render(<Subject size="full" />);
      const sheet = screen.getByRole("dialog", { name: "Delete the task" });
      // Measured where it settles: the opening animation scales it.
      await Promise.all(sheet.getAnimations().map((animation) => animation.finished));
      const free = Number.parseFloat(resolve("var(--space-8)", "width"));
      const box = sheet.getBoundingClientRect();
      expect([
        box.top,
        window.innerWidth - box.right,
        window.innerHeight - box.bottom,
        box.left,
      ]).toEqual([free, free, free, free]);
    } finally {
      await page.viewport(1280, 800);
    }
  });

  it("sinks the footer", () => {
    setTheme(theme);
    render(<Subject />);
    const footer = document.querySelector<HTMLElement>("[data-dialog-footer]");
    expect(footer).not.toBeNull();
    if (footer !== null) {
      expect(paintOf(footer, { background: "" })).toEqual({ background: token("--surface-0") });
    }
  });

  it("keeps Cancel and the confirmation in place beside a reason that does not fit, cut with its tooltip", async () => {
    setTheme(theme);
    const reason = "Write what to discuss or select at least one card, and name the discussion.";
    const footer = (withReason: boolean) => (
      <Dialog open onOpenChange={() => {}} title="Group drafts into an epic">
        <DialogBody>Two drafts.</DialogBody>
        <DialogFooter {...(withReason ? { reason: { id: "reason", text: reason } } : {})}>
          <DialogCancel />
          <Button variant="primary" shortcut="Ctrl ↵">
            Group 2 drafts
          </Button>
        </DialogFooter>
      </Dialog>
    );
    const places = () =>
      ["Cancel", /^Group 2 drafts/].map((name) => {
        const { x, y, width, height } = screen
          .getByRole("button", { name })
          .getBoundingClientRect();
        return { x, y, width, height };
      });
    const { rerender } = render(footer(false));
    const without = places();

    rerender(footer(true));
    expect(places()).toEqual(without);
    const cut = document.getElementById("reason");
    if (cut === null) throw new Error("the reason is not drawn");
    expect(cut.scrollWidth).toBeGreaterThan(cut.clientWidth);
    await userEvent.hover(cut);
    await expect.poll(() => screen.queryByRole("tooltip")?.textContent).toBe(reason);
  });

  it("keeps the primary as wide, and Cancel where it is, dashed and enabled", () => {
    setTheme(theme);
    const footer = (disabled: boolean) => (
      <Dialog open onOpenChange={() => {}} title="Group drafts into an epic">
        <DialogBody>Two drafts.</DialogBody>
        <DialogFooter>
          <DialogCancel />
          <Button variant="primary" shortcut="Ctrl ↵" disabled={disabled}>
            Group 2 drafts
          </Button>
        </DialogFooter>
      </Dialog>
    );
    const places = () => {
      const cancel = screen.getByRole("button", { name: "Cancel" }).getBoundingClientRect();
      const primary = screen
        .getByRole("button", { name: /^Group 2 drafts/ })
        .getBoundingClientRect();
      return { cancel: cancel.x, primary: [primary.x, primary.width] };
    };
    const { rerender } = render(footer(false));
    const enabled = places();

    rerender(footer(true));
    expect(places()).toEqual(enabled);
  });

  it("draws Cancel as a ghost, without a body", () => {
    setTheme(theme);
    render(
      <Dialog open onOpenChange={() => {}} title="Delete the task" alert>
        <DialogBody>The worktree is removed.</DialogBody>
        <DialogFooter>
          <DialogCancel />
          <Button variant="danger">Delete</Button>
        </DialogFooter>
      </Dialog>,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const want = { background: TRANSPARENT, border: TRANSPARENT, color: token("--ink-2") };
    expect(paintOf(cancel, want)).toEqual(want);
  });

  it("draws the close button dashed with closeDisabled", () => {
    setTheme(theme);
    render(<Subject closeDisabled />);
    const want = dashedDisabled();
    expect(paintOf(screen.getByRole("button", { name: "Close" }), want)).toEqual(want);
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
  it("says the whole reason in a tooltip when the keyboard reaches the confirmation it holds back", async () => {
    const reason = "Write what to discuss or select at least one card, and name the discussion.";
    render(
      <Dialog open onOpenChange={() => {}} title="Group drafts into an epic">
        <DialogBody>Two drafts.</DialogBody>
        <DialogFooter reason={{ id: "reason", text: reason }}>
          <DialogCancel />
          <Button variant="primary" shortcut="Ctrl ↵" disabled reasonId="reason">
            Group 2 drafts
          </Button>
        </DialogFooter>
      </Dialog>,
    );
    const confirm = screen.getByRole("button", { name: /^Group 2 drafts/ });
    await expect.poll(() => document.activeElement).not.toBe(document.body);
    while (document.activeElement !== confirm) await userEvent.tab();
    await expect.poll(() => screen.queryByRole("tooltip")?.textContent).toBe(reason);
  });

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
