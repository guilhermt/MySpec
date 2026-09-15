import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewModePicker, ReviewModeValue } from "@/features/review-mode/ReviewModePicker";
import type { ReviewMode } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

function picker(value: ReviewMode = "manual", disabled = false, onChange = vi.fn()) {
  const rendered = renderWithStore(
    <ReviewModePicker label="Task" value={value} onChange={onChange} disabled={disabled} />,
  );
  return { ...rendered, onChange };
}

describe("ReviewModePicker", () => {
  it("writes the mode, with a robot for the agent", () => {
    const { unmount } = picker();

    const manual = screen.getByRole("button", { name: "Task review mode: Manual" });
    expect(manual).toHaveTextContent("Manual");
    // The chevron is the one icon of a manual mode.
    expect(manual.querySelectorAll("svg")).toHaveLength(1);

    unmount();
    picker("agent");

    const agent = screen.getByRole("button", { name: "Task review mode: Agent" });
    expect(agent).toHaveTextContent("Agent");
    expect(agent.querySelectorAll("svg")).toHaveLength(2);
  });

  it("changes the mode", async () => {
    const { user, onChange } = picker();

    await user.click(screen.getByRole("button", { name: "Task review mode: Manual" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Agent" }));

    expect(onChange).toHaveBeenCalledWith("agent");
  });

  it("calls nothing for the mode already checked", async () => {
    const { user, onChange } = picker();

    await user.click(screen.getByRole("button", { name: "Task review mode: Manual" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Manual" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens from the keyboard", async () => {
    const { user } = picker();

    screen.getByRole("button", { name: "Task review mode: Manual" }).focus();
    await user.keyboard("{Enter}");

    expect(await screen.findAllByRole("menuitemradio")).toHaveLength(2);
  });

  it("can't be opened while disabled", async () => {
    const { user } = picker("manual", true);
    const trigger = screen.getByRole("button", { name: "Task review mode: Manual" });

    expect(trigger).toBeDisabled();

    await user.click(trigger);

    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
  });
});

describe("ReviewModeValue", () => {
  it("says why a step went to the user", async () => {
    const { user } = renderWithStore(<ReviewModeValue mode="manual" fallback="rounds_exhausted" />);
    const reason = "The agent review didn't come clean after three rounds";

    expect(screen.getByText("Manual")).toBeInTheDocument();
    // A screen reader reads the reason with the mode; the tooltip shows it on focus.
    expect(screen.getByText(reason)).toHaveClass("sr-only");

    await user.tab();

    // The tooltip has no role of its own: the reason is written a second time, in it.
    await waitFor(() => {
      expect(screen.getAllByText(reason)).toHaveLength(2);
    });
  });

  it("says nothing more for a step whose mode held", async () => {
    const { user } = renderWithStore(<ReviewModeValue mode="agent" fallback="" />);

    expect(screen.getByText("Agent")).toBeInTheDocument();

    await user.tab();

    expect(document.body).toHaveFocus();
    expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeInTheDocument();
  });
});
