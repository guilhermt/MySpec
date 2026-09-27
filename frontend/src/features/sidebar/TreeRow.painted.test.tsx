import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { taskRow } from "@/features/sidebar/sidebar-tree";
import { TreeRow } from "@/features/sidebar/TreeRow";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
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
    const want = {
      shadow: resolve("inset var(--error-rail) 0 0 var(--state-error)", "box-shadow"),
    };
    expect(paintOf(screen.getByRole("treeitem"), want)).toEqual(want);
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
