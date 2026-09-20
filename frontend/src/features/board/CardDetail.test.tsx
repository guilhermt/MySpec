import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardDetail } from "@/features/board/CardDetail";
import type { StartCard } from "@/features/board/useStartCard";
import { api, type BoardCard, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedTask,
  makeBoard,
  makeBoardCard,
  makeRepository,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const ISSUE = {
  repository: "dev/web",
  url: "https://github.com/dev/web/issues/1",
  state: "open",
};

function startCard(): StartCard {
  return {
    run: vi.fn(),
    clone: vi.fn(() => Promise.resolve()),
    busy: false,
    error: null,
    offer: null,
    setOffer: vi.fn(),
  };
}

function detail(card: BoardCard, state: State = makeState()) {
  const onClose = vi.fn();
  const onSelect = vi.fn();
  const onDiscuss = vi.fn();
  const start = startCard();
  const rendered = renderWithStore(
    <CardDetail
      board={makeBoard({ cards: [card] })}
      card={card}
      start={start}
      onClose={onClose}
      onSelect={onSelect}
      onDiscuss={onDiscuss}
    />,
    { state: { ...state, repositories: [makeRepository({ boardId: "board-1" })] } },
  );
  return { ...rendered, onClose, onSelect, onDiscuss, start };
}

describe("CardDetail", () => {
  it("shows the issue, its status, fields, assignees and body", () => {
    detail(
      makeBoardCard({
        fields: [{ name: "Priority", value: "High" }],
        assignees: [{ login: "ana", avatarUrl: "" }],
      }),
    );

    expect(screen.getByRole("heading", { name: "Add the login screen" })).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByRole("definition")).toHaveTextContent("High");
    expect(screen.getByText("ana")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("Email and password.");
  });

  it("says when the card has no description", () => {
    detail(makeBoardCard({ body: "" }));

    expect(screen.getByText("No description.")).toBeInTheDocument();
  });

  it("opens GitHub from its link and closes", async () => {
    const { user, onClose } = detail(makeBoardCard());

    await user.click(screen.getByRole("link", { name: "Open on GitHub" }));
    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");

    await user.click(screen.getByRole("button", { name: "Close card" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("lists the epic and the siblings, selecting the ones on the board", async () => {
    const { user, onSelect } = detail(
      makeBoardCard({
        epic: { ...ISSUE, key: "dev/web#1", number: 1, title: "Accounts" },
        siblings: [
          {
            ...ISSUE,
            key: "dev/web#13",
            number: 13,
            title: "Logout",
            status: "Done",
            onBoard: true,
          },
          {
            ...ISSUE,
            key: "dev/web#14",
            number: 14,
            title: "Reset",
            state: "closed",
            status: "",
            onBoard: false,
          },
        ],
      }),
    );

    expect(screen.getByRole("link", { name: "#1 Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#14 Reset · Closed" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "#13 Logout · Done" }));

    expect(onSelect).toHaveBeenCalledWith("dev/web#13");
  });

  it("marks the dependencies that are not satisfied, with their pull requests", () => {
    const pr = { repository: "dev/api", number: 5, url: "https://github.com/dev/api/pull/5" };
    detail(
      makeBoardCard({
        dependencies: [
          {
            ...ISSUE,
            key: "dev/web#2",
            number: 2,
            title: "Schema",
            status: "In progress",
            onBoard: true,
            pullRequests: [{ ...pr, state: "open" }],
            satisfied: false,
          },
          {
            ...ISSUE,
            key: "dev/web#3",
            number: 3,
            title: "Tokens",
            state: "closed",
            status: "",
            onBoard: false,
            pullRequests: [],
            satisfied: true,
          },
        ],
        pullRequests: [
          { ...pr, number: 9, url: "https://github.com/dev/api/pull/9", state: "merged" },
        ],
      }),
    );

    expect(screen.getAllByText("Not satisfied")).toHaveLength(1);
    expect(screen.getByText("Open · In progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dev/api#5 · Open" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dev/api#9 · Merged" })).toBeInTheDocument();
  });

  it("opens the active task of the card", async () => {
    const { user } = detail(
      makeBoardCard({ activeTaskId: "task-1", action: "has_task" }),
      makeState({ tasks: [makeTask()] }),
    );

    await user.click(screen.getByRole("button", { name: "add-login" }));

    expect(useAppStore.getState().openTaskId).toBe("task-1");
    expect(screen.queryByRole("button", { name: /^Start task/ })).not.toBeInTheDocument();
  });

  it("opens the archived task of the card in the history", async () => {
    const { user } = detail(
      makeBoardCard({ archivedTaskId: "old" }),
      makeState({ history: [makeArchivedTask({ id: "old", name: "fix-login" })] }),
    );

    await user.click(screen.getByRole("button", { name: "Archived: fix-login" }));

    expect(useAppStore.getState().openArchivedId).toBe("old");
  });

  it("runs Start task from its button", async () => {
    const { user, start } = detail(makeBoardCard());

    await user.click(screen.getByRole("button", { name: /^Start task/ }));

    expect(start.run).toHaveBeenCalled();
  });

  it("discusses the card from its button", async () => {
    const { user, onDiscuss } = detail(makeBoardCard());

    await user.click(screen.getByRole("button", { name: /^Discuss/ }));

    expect(onDiscuss).toHaveBeenCalledOnce();
  });
});
