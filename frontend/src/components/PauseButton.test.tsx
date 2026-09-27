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
});
