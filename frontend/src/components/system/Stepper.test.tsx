import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import type { PillView } from "./Pill";
import { Stepper, type StepperProps } from "./Stepper";

const PILL: PillView = {
  name: "Implementation",
  position: "3/7",
  qualifier: "pass 2",
  keepsQualifier: false,
  glyph: "wait",
  word: "",
  shimmer: false,
  paused: false,
  state: "waiting for you: question in Reviewer",
};

const PROPS: StepperProps = {
  steps: [
    { id: "prd", name: "PRD", state: "done" },
    { id: "techspec", name: "Tech spec", state: "done" },
    { id: "plan", name: "Plan", state: "done" },
    { id: "implementation", name: "Implementation", state: "current" },
    { id: "pr", name: "PR", state: "upcoming" },
    { id: "pr_review", name: "PR review", state: "upcoming" },
    { id: "closing", name: "Closing", state: "upcoming" },
  ],
  pill: PILL,
  label: "Progress · Implementation 3/7 · pass 2 · waiting for you: question in Reviewer",
  tooltip: [
    "✓ PRD  ✓ Tech spec  ✓ Plan  ● Implementation 3/7 · pass 2  ○ PR  ○ PR review  ○ Closing",
    "Paused since 14:52",
  ],
};

describe("Stepper", () => {
  it("is an ordered list named by the whole progress", () => {
    renderWithStore(<Stepper {...PROPS} />);
    const list = screen.getByRole("list", { name: PROPS.label });
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(7);
  });

  it("is one Tab stop with no action", async () => {
    const { user } = renderWithStore(<Stepper {...PROPS} />);
    await user.tab();
    expect(screen.getByRole("list", { name: PROPS.label })).toHaveFocus();
    expect(screen.queryByRole("button")).toBeNull();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("marks the current stage and draws its pill", () => {
    renderWithStore(<Stepper {...PROPS} />);
    const current = screen
      .getAllByRole("listitem")
      .find((item) => item.getAttribute("aria-current") === "step");
    expect(current).toHaveTextContent("Implementation3/7 · pass 2");
  });

  it("tells the reader the done and the upcoming stages", () => {
    renderWithStore(<Stepper {...PROPS} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("PRD · done");
    expect(items[4]).toHaveTextContent("PR · to come");
  });

  it("opens the list of the stages on keyboard focus, one line each", async () => {
    const { user } = renderWithStore(<Stepper {...PROPS} />);
    await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText(/^✓ PRD/)).toBeInTheDocument();
    expect(within(tooltip).getByText("Paused since 14:52")).toBeInTheDocument();
  });

  it("opens the list of the stages on hover over the pill, and only that tooltip", async () => {
    const { user } = renderWithStore(<Stepper {...PROPS} />);
    await user.hover(screen.getByText("Implementation"));
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(within(tooltip).getByText(/^✓ PRD/)).toBeInTheDocument();
    expect(within(tooltip).getByText("Paused since 14:52")).toBeInTheDocument();
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });

  it("shows a done folded stage's name and word on hover", async () => {
    const { user } = renderWithStore(<Stepper {...PROPS} />);
    await user.hover(screen.getByText("PRD"));
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(tooltip).toHaveTextContent("PRD · done");
  });

  it("shows an upcoming folded stage's name and word on hover", async () => {
    const { user } = renderWithStore(<Stepper {...PROPS} />);
    await user.hover(screen.getByText("PR"));
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(tooltip).toHaveTextContent("PR · to come");
  });

  it("gives way by the width of the main area", () => {
    renderWithStore(<Stepper {...PROPS} />);
    expect(screen.getByText("PRD")).toHaveClass("@max-[1200px]/main:sr-only");
    expect(screen.getByText("Closing")).toHaveClass("@max-[900px]/main:sr-only");
  });

  it("glows over the names with no pill while loading", () => {
    renderWithStore(<Stepper {...PROPS} loading />);
    const list = screen.getByRole("list", { name: PROPS.label });
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(within(list).queryByRole("listitem", { current: "step" })).toBeNull();
    expect(screen.getByText("Implementation")).toHaveClass("shimmer-text");
    expect(screen.queryByText("3/7")).toBeNull();
  });
});
