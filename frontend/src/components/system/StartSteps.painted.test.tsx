import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token, withoutTooltip } from "@/test/painted";
import { StartSteps, type StartStepView } from "./StartSteps";

const STEPS: StartStepView[] = [
  { id: "open", label: "Opening your data", state: "done", elapsed: "0.4s", reason: "" },
  {
    id: "clones",
    label: "Checking the clones",
    state: "running",
    elapsed: "3s",
    reason: "~/code/infra doesn't answer",
  },
  { id: "load", label: "Loading your work", state: "todo", elapsed: "", reason: "" },
];

describe.each(THEMES)("StartSteps in the %s theme", (theme) => {
  it("paints done in the first ink, running at 500 and to do in the third", () => {
    setTheme(theme);
    render(<StartSteps steps={STEPS} />);
    const done = getComputedStyle(screen.getByText("Opening your data"));
    const running = getComputedStyle(screen.getByText("Checking the clones"));
    const todo = getComputedStyle(screen.getByText("Loading your work"));
    expect(done.color).toBe(token("--ink-1"));
    expect(running.color).toBe(token("--ink-1"));
    expect(running.fontWeight).toBe("500");
    expect(todo.color).toBe(token("--ink-3"));
  });

  it("writes the time and the reason in the meta size, third ink, tabular", () => {
    setTheme(theme);
    render(<StartSteps steps={STEPS} />);
    for (const text of ["3s", "~/code/infra doesn't answer"]) {
      const style = getComputedStyle(screen.getByText(text));
      expect(style.color).toBe(token("--ink-3"));
      expect(style.fontSize).toBe(resolve("var(--text-meta)", "font-size"));
      expect(style.fontVariantNumeric).toContain("tabular-nums");
    }
  });

  it("keeps the label whole and cuts the reason of a long path, with its tooltip", async () => {
    setTheme(theme);
    const path = "/mnt/team-share/engineering/platform/infrastructure/terraform-modules";
    render(
      <div style={{ width: "24rem" }}>
        <StartSteps
          steps={[
            {
              id: "clones",
              label: "Checking the clones",
              state: "running",
              elapsed: "12s",
              reason: `${path} doesn't answer`,
            },
          ]}
        />
      </div>,
    );
    const label = screen.getByText("Checking the clones");
    expect(label.getBoundingClientRect().height).toBe(
      parseFloat(resolve("var(--leading-ui)", "height")),
    );
    const reason = screen.getByText(`${path} doesn't answer`);
    expect(reason.scrollWidth).toBeGreaterThan(reason.clientWidth);
    expect(await withoutTooltip([reason])).toEqual([]);
  });

  it("lays each step in three columns", () => {
    setTheme(theme);
    render(<StartSteps steps={STEPS} />);
    const columns = getComputedStyle(
      screen.getAllByRole("listitem")[0] as Element,
    ).gridTemplateColumns;
    expect(columns.split(" ")).toHaveLength(3);
    expect(columns.split(" ")[0]).toBe(resolve("var(--icon)", "width"));
  });
});
