import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { TOOLTIP_DELAY_MS, Tooltip } from "./Tooltip";

const TOKENS = readFileSync(
  join(import.meta.dirname, "../../../../design/system/tokens.css"),
  "utf8",
);

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

  it("keeps the delay of tokens.css", () => {
    expect(TOKENS).toContain(`--delay-tooltip: ${TOOLTIP_DELAY_MS}ms`);
  });
});
