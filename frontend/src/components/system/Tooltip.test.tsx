import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { TOOLTIP_DELAY_MS, TOOLTIP_OFFSET_PX, Tooltip } from "./Tooltip";

const TOKENS = readFileSync(join(import.meta.dirname, "../../styles/tokens.css"), "utf8");

function Subject() {
  return (
    <Tooltip content="Approve" shortcut="Ctrl Enter" sub="Commits the step">
      <button type="button">Approve step</button>
    </Tooltip>
  );
}

describe("Tooltip", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens after the tooltip delay on hover", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Subject />);
    await user.hover(screen.getByRole("button", { name: "Approve step" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Commits the step");
  });

  it("opens at once on keyboard focus", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Approve");
  });

  it("stays closed on a focus that is not visible, like the one a pointer leaves a dialog with", async () => {
    const { user } = renderWithStore(
      <>
        <button type="button">Open the dialog</button>
        <Subject />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Open the dialog" }));
    act(() => screen.getByRole("button", { name: "Approve step" }).focus());
    expect(screen.getByRole("button", { name: "Approve step" })).toHaveFocus();
    // Give a tooltip the time it would take to open on focus.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on Escape", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    await screen.findByText("Commits the step");
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByText("Commits the step")).toBeNull());
  });

  it("closes when something scrolls", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    await screen.findByText("Commits the step");
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(screen.queryByText("Commits the step")).toBeNull());
  });

  it("shows the key of the action", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    expect((await screen.findByText("Ctrl Enter")).tagName).toBe("KBD");
  });

  it("stays closed under the pointer without hover, and opens on keyboard focus", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Tooltip content="The stages" hover={false}>
        <button type="button">Progress</button>
      </Tooltip>,
    );
    await user.hover(screen.getByRole("button", { name: "Progress" }));
    await act(async () => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS * 2);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.unhover(screen.getByRole("button", { name: "Progress" }));
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("The stages");
  });

  it("writes a list of strings one per line", async () => {
    const { user } = renderWithStore(
      <Tooltip content={["✓ PRD  ● Tech spec", "Paused since 14:52"]}>
        <button type="button">Progress</button>
      </Tooltip>,
    );
    await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText(/^✓ PRD/).parentElement).toHaveClass("flex-col");
    expect(within(tooltip).getByText("Paused since 14:52")).toBeInTheDocument();
  });

  it("keeps the delay of tokens.css", () => {
    expect(TOKENS).toContain(`--delay-tooltip: ${TOOLTIP_DELAY_MS}ms`);
  });

  it("keeps the gap of tokens.css", () => {
    expect(TOKENS).toContain(`--space-1-5: ${TOOLTIP_OFFSET_PX / 16}rem`);
  });
});
