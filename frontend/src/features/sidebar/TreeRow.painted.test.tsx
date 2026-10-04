import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { taskRow } from "@/features/sidebar/sidebar-tree";
import { TreeRow } from "@/features/sidebar/TreeRow";
import { NONE, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { makeSituation, makeState, makeTask } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-05T12:00:00Z");

const idle = taskRow(makeState(), makeTask({ stage: "prd" }), NOW);
const waiting = taskRow(
  makeState(),
  makeTask({ situations: [makeSituation({ kind: "question" })] }),
  NOW,
);
const failed = taskRow(
  makeState(),
  makeTask({ situations: [makeSituation({ kind: "session_error", group: "error" })] }),
  NOW,
);

describe.each(THEMES)("TreeRow in the %s theme", (theme) => {
  it("lifts the open row in the brand veil with its ring", () => {
    setTheme(theme);
    render(
      <TreeRow
        row={idle}
        level={2}
        selected
        isNext={false}
        flash={null}
        narrow={false}
        tabIndex={0}
      />,
    );
    const want = {
      background: token("--brand-veil"),
      shadow: resolve("inset 0 0 0 var(--border) var(--brand-ring)", "box-shadow"),
    };
    expect(paintOf(screen.getByRole("treeitem"), want)).toEqual(want);
  });

  it("writes line 2 of the open row in the second ink while it is pressed", () => {
    setTheme(theme);
    render(
      <TreeRow
        row={waiting}
        level={2}
        selected
        isNext={false}
        flash={null}
        narrow={false}
        tabIndex={0}
      />,
    );
    const row = screen.getByRole("treeitem");
    const line2 = [...row.querySelectorAll<HTMLElement>("span")].find((span) =>
      span.className.includes("gap-(--space-1-5)"),
    );
    if (line2 === undefined) {
      throw new Error("line 2 is not drawn");
    }
    expect(getComputedStyle(line2).color).toBe(token("--ink-3"));
    // The browser of the tests can't hold a press; the variant is the one that paints it.
    expect(line2.className).toContain("group-active/row:text-ink-2");
  });

  it("draws the error rail on the left edge", () => {
    setTheme(theme);
    render(
      <TreeRow
        row={failed}
        level={2}
        selected={false}
        isNext={false}
        flash={null}
        narrow={false}
        tabIndex={0}
      />,
    );
    // A straight bar, inset from the top and the bottom, not a shadow that bends with the radius.
    const rail = getComputedStyle(screen.getByRole("treeitem"), "::before");
    expect({
      background: rail.backgroundColor,
      width: rail.width,
      top: rail.top,
      bottom: rail.bottom,
      left: rail.left,
      corner: rail.borderTopLeftRadius,
    }).toEqual({
      background: token("--state-error"),
      width: resolve("var(--error-rail)", "width"),
      top: resolve("var(--space-1-5)", "top"),
      bottom: resolve("var(--space-1-5)", "bottom"),
      left: "0px",
      corner: "0px",
    });
    expect(paintOf(screen.getByRole("treeitem"), { shadow: NONE })).toEqual({ shadow: NONE });
  });

  it("makes the name of a row that waits bold, and leaves the others regular", () => {
    setTheme(theme);
    render(
      <>
        <TreeRow
          row={waiting}
          level={2}
          selected={false}
          isNext={false}
          flash={null}
          narrow={false}
          tabIndex={0}
        />
        <TreeRow
          row={idle}
          level={2}
          selected={false}
          isNext={false}
          flash={null}
          narrow={false}
          tabIndex={-1}
        />
      </>,
    );
    const [bold, regular] = screen.getAllByText("add-login", { selector: "span.truncate" });
    expect(bold && getComputedStyle(bold).fontWeight).toBe("600");
    expect(regular && getComputedStyle(regular).fontWeight).toBe("400");
  });

  it("writes the verb of line 3 in the third ink and what it acts on in the fourth", () => {
    setTheme(theme);
    const working = taskRow(
      makeState(),
      makeTask({
        stage: "prd",
        sessionStatus: "working",
        turnRunning: true,
        actionLabel: "Reading",
        actionTarget: "go.mod",
      }),
      NOW,
    );
    render(
      <TreeRow
        row={working}
        level={2}
        selected={false}
        isNext={false}
        flash={null}
        narrow={false}
        tabIndex={0}
      />,
    );
    const verb = screen.getByText("Reading", { selector: "span" });
    const line = verb.parentElement;
    if (line === null) throw new Error("line 3");
    const third = { color: token("--ink-3") };
    const fourth = { color: token("--ink-4") };
    expect(paintOf(verb, third)).toEqual(third);
    expect(paintOf(line, fourth)).toEqual(fourth);
  });

  it("never widens the tree it sits in with the copies it measures", () => {
    setTheme(theme);
    const long = taskRow(
      makeState(),
      makeTask({
        name: "idempotency-keys-for-payment-intents-and-refunds-across-every-api",
        situations: [makeSituation({ kind: "question" })],
      }),
      NOW,
    );
    render(
      <div data-testid="tree" style={{ width: "288px", overflow: "auto" }}>
        <TreeRow
          row={long}
          level={2}
          selected
          isNext={false}
          flash={null}
          narrow={false}
          tabIndex={0}
        />
      </div>,
    );
    const tree = screen.getByTestId("tree");
    expect(tree.scrollWidth).toBe(tree.clientWidth);
  });
});
