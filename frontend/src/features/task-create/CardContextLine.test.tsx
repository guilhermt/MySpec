import { screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CardContextLine } from "@/features/task-create/CardContextLine";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoardCard, makeState } from "@/test/wails-mock";

const FRESH = () => new Date(Date.now() - 60_000).toISOString();
const STALE = () => new Date(Date.now() - 10 * 60_000).toISOString();

function Line({ readAt }: { readAt: string }) {
  const [additional, setAdditional] = useState("");
  return (
    <CardContextLine
      boardId="board-1"
      card={makeBoardCard({ readAt })}
      additional={additional}
      onAdditionalChange={setAdditional}
    />
  );
}

function line(readAt: string) {
  return renderWithStore(<Line readAt={readAt} />, { state: makeState() });
}

describe("CardContextLine", () => {
  it("says what the context has, with its size, once it is read", async () => {
    vi.mocked(api.cardContext).mockResolvedValue("x".repeat(1200));

    line(FRESH());

    expect(await screen.findByText("From the card: #12 · 1,200 characters")).toBeVisible();
    expect(api.cardContext).toHaveBeenCalledWith("board-1", "dev/web#12");
    expect(api.refreshCard).not.toHaveBeenCalled();
  });

  it("shows and hides the context of the card", async () => {
    const { user } = line(FRESH());
    await screen.findByText(/characters/);

    const show = screen.getByRole("button", { name: "Show" });
    expect(show).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();

    await user.click(show);

    expect(await screen.findByTestId("markdown")).toHaveTextContent(
      "### Card: Add the login screen",
    );
    expect(screen.getByLabelText("The context from the card")).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  it("opens the additional context on Add to it, and keeps it", async () => {
    const { user } = line(FRESH());

    expect(screen.queryByLabelText(/Additional context/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add to it" }));

    const field = screen.getByLabelText(/Additional context/);
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute(
      "placeholder",
      "Anything the card doesn't say. It goes at the end of the context.",
    );
    expect(screen.queryByRole("button", { name: "Add to it" })).not.toBeInTheDocument();

    await user.type(field, "Start with the form");

    expect(field).toHaveValue("Start with the form");
  });

  it("reads a stale card again and its context after", async () => {
    let finish = () => {};
    vi.mocked(api.refreshCard).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );

    line(STALE());

    expect(await screen.findByRole("status")).toHaveTextContent("Refreshing the card…");
    expect(api.refreshCard).toHaveBeenCalledOnce();
    expect(api.refreshCard).toHaveBeenCalledWith("board-1", "dev/web#12");
    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("The card is being read again.")).toBeVisible();

    vi.mocked(api.cardContext).mockResolvedValue("### Card: Refreshed\n");
    finish();

    await waitFor(() => {
      expect(screen.queryByText("Refreshing the card…")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(api.cardContext).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("aria-disabled", "false");
  });

  it("says the task will use the last reading when the refresh fails", async () => {
    vi.mocked(api.refreshCard).mockRejectedValue(new Error("GitHub rate limit reached."));

    line(STALE());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "◇ Couldn't refresh the card: GitHub rate limit reached. The task will use the last reading.",
    );
    expect(screen.getByRole("status")).toHaveTextContent("From the card: #12");
  });

  it("counts nothing and keeps Show out of reach when the context could not be read", async () => {
    vi.mocked(api.cardContext).mockResolvedValue("");

    line(FRESH());

    await waitFor(() => expect(api.cardContext).toHaveBeenCalled());
    expect(screen.getByText("From the card: #12")).toBeVisible();
    expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("The context isn't read yet.")).toBeVisible();
  });
});
