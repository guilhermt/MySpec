import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionDetails } from "@/features/discussion/DiscussionDetails";
import { api, type DiscussionSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDiscussionCard,
  makeDraft,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

function details(
  overrides: Partial<DiscussionSummary> = {},
  state: Parameters<typeof makeState>[0] = {},
) {
  const discussion = makeDiscussion(overrides);
  return renderWithStore(<DiscussionDetails discussion={discussion} />, {
    state: makeState({
      boards: [makeBoard({ cards: [makeBoardCard()] })],
      repositories: [makeRepository()],
      discussions: [discussion],
      ...state,
    }),
    ui: { location: { kind: "discussion", id: discussion.id }, panel: "details" },
  });
}

const section = (name: string) => screen.getByRole("region", { name });

describe("DiscussionDetails", () => {
  it("has the three sections of the discussion", () => {
    details();

    expect(screen.getByRole("complementary", { name: "Details" })).toBeInTheDocument();
    for (const name of ["Discussion", "Rounds", "Documents"]) {
      expect(section(name)).toBeInTheDocument();
    }
  });

  it("says the facts, the board opening its view", async () => {
    const { user } = details();
    const facts = section("Discussion");

    expect(within(facts).getByText("Model")).toBeInTheDocument();
    expect(within(facts).getByText("Read")).toBeInTheDocument();
    expect(within(facts).getByText("dev/web")).toBeInTheDocument();

    await user.click(within(facts).getByRole("link", { name: "Roadmap" }));

    expect(useAppStore.getState().location).toEqual({ kind: "board", id: "board-1" });
  });

  it("opens a card of the reading in its panel on the board", async () => {
    const { user } = details();

    await user.click(within(section("Discussion")).getByRole("link", { name: "#12" }));

    expect(useAppStore.getState().boardCardRequest).toEqual({
      boardId: "board-1",
      key: "dev/web#12",
    });
  });

  it("opens a card that isn't in the reading on GitHub", async () => {
    const { user } = details({
      cards: [
        makeDiscussionCard({
          key: "dev/web#99",
          number: 99,
          url: "https://github.com/dev/web/issues/99",
        }),
      ],
    });

    await user.click(within(section("Discussion")).getByRole("link", { name: "#99" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/99");
  });

  it("offers to clone a repository without a clone", async () => {
    const { user } = details(
      { repositories: [{ id: "repo-2", fullName: "dev/api", cloned: false, missing: false }] },
      {
        repositories: [
          makeRepository({ id: "repo-2", fullName: "dev/api", name: "api", cloned: false }),
        ],
      },
    );

    expect(within(section("Discussion")).getByText("Not cloned")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-2");
  });

  it("lists the rounds without acting", () => {
    details({
      round: 1,
      drafts: [makeDraft({ round: 1, published: true, outcome: "created" })],
    });

    const rounds = section("Rounds");
    expect(rounds).toHaveTextContent("Round 1 · 1 draft · 1 created");
    expect(within(rounds).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says No drafts yet before the first round", () => {
    details();

    expect(section("Rounds")).toHaveTextContent("No drafts yet");
  });

  it("opens Documents at the document of a row, the Document one disabled before it exists", async () => {
    const { user } = details();
    const documents = section("Documents");

    expect(
      within(documents).getByText("Document · written with the drafts").closest("li"),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(within(documents).getByRole("button", { name: "Context" }));

    expect(useAppStore.getState().panel).toBe("documents");
    expect(useAppStore.getState().panelDocument).toBe("context.md");
  });

  it("opens the document once it is written", async () => {
    const { user } = details({ hasDocument: true });

    await user.click(screen.getByRole("button", { name: "Document · discussion.md" }));

    expect(useAppStore.getState().panelDocument).toBe("discussion.md");
  });

  it("closes with ×", async () => {
    const { user } = details();

    await user.click(
      within(screen.getByRole("complementary")).getByRole("button", { name: "Close" }),
    );

    expect(useAppStore.getState().panel).toBeNull();
  });
});
