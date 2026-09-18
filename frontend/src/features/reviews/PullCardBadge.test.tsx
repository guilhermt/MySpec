import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PullCardBadge } from "@/features/reviews/PullCardBadge";
import { api, type PullCard } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

const CARD: PullCard = {
  boardId: "board-1",
  number: 12,
  title: "Add the login screen",
  url: "https://github.com/dev/web/issues/12",
  status: "In review",
};

describe("PullCardBadge", () => {
  it("opens the card of the pull request and shows its status", async () => {
    const { user } = renderWithStore(<PullCardBadge card={CARD} />, { state: makeState() });

    expect(screen.getByText("In review")).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "#12" }));
    expect(await screen.findByText("Add the login screen")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "#12" }));
    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("shows no empty status", () => {
    renderWithStore(<PullCardBadge card={{ ...CARD, status: "" }} />, { state: makeState() });

    expect(screen.queryByText("In review")).not.toBeInTheDocument();
  });
});
