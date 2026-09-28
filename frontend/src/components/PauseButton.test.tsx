import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PauseButton } from "@/components/PauseButton";
import { renderWithStore } from "@/test/render";

describe("PauseButton", () => {
  it("pauses a running conversation", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(<PauseButton paused={false} onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("resumes a paused conversation", () => {
    renderWithStore(<PauseButton paused onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("keeps its name in the tooltip, for when only the icon shows", async () => {
    const { user } = renderWithStore(<PauseButton paused={false} onClick={vi.fn()} />);

    await user.hover(screen.getByRole("button", { name: "Pause" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Pause");
  });

  it("does nothing while disabled", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(<PauseButton paused={false} disabled onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("says Pausing… with the spinner while it pauses, and does nothing more", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(<PauseButton paused={false} loading onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Pausing…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("says Resuming… while it resumes", () => {
    renderWithStore(<PauseButton paused loading onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Resuming…" })).toBeInTheDocument();
  });

  it("says why it is disabled, in its tooltip and its description", async () => {
    const onClick = vi.fn();
    const reason = "Nothing is running to pause";
    const { user } = renderWithStore(
      <PauseButton paused={false} disabledReason={reason} onClick={onClick} />,
    );

    const button = screen.getByRole("button", { name: "Pause" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(reason);
    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("says what it does to the item it pauses", async () => {
    const { user } = renderWithStore(
      <PauseButton paused={false} item="the task" onClick={vi.fn()} />,
    );

    const button = screen.getByRole("button", { name: "Pause" });
    expect(button).toHaveAccessibleDescription("Pause the task · the session that works stops");
    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Pause the task · the session that works stops",
    );
  });

  it.each([
    ["14:52", "Resume the task · paused since 14:52"],
    ["", "Resume the task"],
  ])("resumes the item paused since %j", (pausedSince, description) => {
    renderWithStore(
      <PauseButton paused pausedSince={pausedSince} item="the task" onClick={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Resume" })).toHaveAccessibleDescription(description);
  });
});
