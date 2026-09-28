import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardPanel } from "@/features/task/CardPanel";
import { api, type Board } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeBoardCard, makeState, makeTask, makeTaskCard } from "@/test/wails-mock";

const EPIC = {
  key: "dev/web#10",
  repository: "dev/web",
  number: 10,
  title: "Accounts",
  url: "https://github.com/dev/web/issues/10",
  state: "open",
};

/** READ_CARD is the card of the task as the last reading of the board has it, with every relation. */
const READ_CARD = makeBoardCard({
  status: "Todo",
  body: "Email and password.",
  epic: EPIC,
  siblings: [
    {
      key: "dev/web#13",
      repository: "dev/web",
      number: 13,
      title: "Reset the password",
      url: "https://github.com/dev/web/issues/13",
      state: "open",
      status: "In progress",
      onBoard: true,
    },
    {
      key: "dev/web#14",
      repository: "dev/web",
      number: 14,
      title: "Sign out",
      url: "https://github.com/dev/web/issues/14",
      state: "closed",
      status: "",
      onBoard: false,
    },
  ],
  dependencies: [
    {
      key: "dev/api#7",
      repository: "dev/api",
      number: 7,
      title: "Session tokens",
      url: "https://github.com/dev/api/issues/7",
      state: "open",
      status: "",
      onBoard: false,
      pullRequests: [],
      satisfied: false,
    },
  ],
  pullRequests: [
    { repository: "dev/web", number: 21, url: "https://github.com/dev/web/pull/21", state: "open" },
    {
      repository: "dev/api",
      number: 8,
      url: "https://github.com/dev/api/pull/8",
      state: "merged",
    },
  ],
});

/** KEPT_EPIC is the epic as the task keeps it, with no state. */
const KEPT_EPIC = { ...EPIC, state: "" };

function panel(boards: Board[]) {
  const task = makeTask({ card: makeTaskCard({ status: "In progress", epic: KEPT_EPIC }) });
  return renderWithStore(<CardPanel task={task} />, {
    state: makeState({ tasks: [task], boards }),
    ui: { location: { kind: "task", id: task.id }, panel: "card" },
  });
}

const group = (name: string) => screen.getByRole("region", { name });
const texts = (name: string) =>
  within(group(name))
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("CardPanel", () => {
  it("is the aside of the card, named by its number", () => {
    panel([makeBoard({ cards: [READ_CARD] })]);

    expect(screen.getByRole("complementary", { name: "Card #12" })).toBeInTheDocument();
  });

  it("shows the reference, the status of the board, the title and the body of the last reading", () => {
    panel([makeBoard({ cards: [READ_CARD] })]);

    expect(screen.getByText("dev/web#12")).toBeInTheDocument();
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Add the login screen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Email and password.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens the card on GitHub", async () => {
    const { user } = panel([makeBoard({ cards: [READ_CARD] })]);

    await user.click(screen.getByRole("link", { name: "Open on GitHub" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("lists the epic, the cards of the epic, the dependencies and the pull requests", () => {
    panel([makeBoard({ cards: [READ_CARD] })]);

    expect(texts("Epic")).toEqual(["#10 Accounts"]);
    expect(texts("Cards of the epic · 2")).toEqual([
      "#13 Reset the passwordIn progress",
      "#14 Sign outClosed",
    ]);
    expect(texts("Dependencies")).toEqual(["dev/api#7 Session tokensOpen◇ Not satisfied"]);
    expect(texts("Pull requests")).toEqual(["#21 Open", "dev/api#8 Merged"]);
  });

  it("opens a relation on GitHub", async () => {
    const { user } = panel([makeBoard({ cards: [READ_CARD] })]);

    await user.click(screen.getByRole("link", { name: "dev/api#7 Session tokens" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/api/issues/7");
  });

  it("leaves out the groups without relations", () => {
    panel([makeBoard({ cards: [makeBoardCard()] })]);

    for (const name of ["Epic", "Cards of the epic · 0", "Dependencies", "Pull requests"]) {
      expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
    }
  });

  it.each([
    [
      "the card isn't in the last reading",
      [makeBoard()],
      "This card isn't in the last reading of the board.",
    ],
    ["the board was never read", [makeBoard({ readAt: "" })], "The board hasn't been read yet."],
    ["the board was removed", [], "The board of this card was removed."],
  ])("says why it shows only what the task keeps when %s", (_, boards, notice) => {
    panel(boards);

    expect(screen.getByRole("status")).toHaveTextContent(notice);
    expect(screen.getByText("dev/web#12")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Add the login screen" }),
    ).toBeInTheDocument();
    expect(texts("Epic")).toEqual(["#10 Accounts"]);
    expect(screen.queryByText("Email and password.")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Dependencies" })).not.toBeInTheDocument();
  });

  it("closes from its close button", async () => {
    const { user } = panel([makeBoard({ cards: [READ_CARD] })]);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(useAppStore.getState().panel).toBeNull();
  });

  it("draws nothing for a task without a card", () => {
    const task = makeTask();
    const { container } = renderWithStore(<CardPanel task={task} />, {
      state: makeState({ tasks: [task] }),
    });

    expect(container).toBeEmptyDOMElement();
  });
});
