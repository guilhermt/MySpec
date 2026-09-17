import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskCardBadge } from "@/features/task/TaskCardBadge";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeTaskCard } from "@/test/wails-mock";

describe("TaskCardBadge", () => {
  it("opens the issue of the card and shows its status", async () => {
    const { user } = renderWithStore(<TaskCardBadge card={makeTaskCard()} />, {
      state: makeState(),
    });

    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.queryByText("Issue closed")).not.toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "#12" }));
    expect(await screen.findByText("Add the login screen")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "#12" }));
    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("says when the issue was closed, and shows no empty status", () => {
    renderWithStore(<TaskCardBadge card={makeTaskCard({ status: "", state: "closed" })} />, {
      state: makeState(),
    });

    expect(screen.getByText("Issue closed")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
  });
});
