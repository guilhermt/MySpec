import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { ICONS } from "./icons";
import {
  type BlockerView,
  BoardStartRow,
  type BoardStartRowProps,
  NoBoardRow,
  StartRow,
  type StartRowProps,
} from "./StartRow";

function row(props: Partial<StartRowProps> = {}) {
  const onClick = vi.fn();
  const rendered = renderWithStore(
    <StartRow icon={ICONS.review} label="Review a pull request" onClick={onClick} {...props} />,
  );
  return { ...rendered, onClick };
}

describe("StartRow", () => {
  it("is named by its label and described by its sub", () => {
    row({ sub: "4 pending in 3 repositories" });
    expect(
      screen.getByRole("button", {
        name: "Review a pull request",
        description: "4 pending in 3 repositories",
      }),
    ).toBeInTheDocument();
  });

  it("clicks", async () => {
    const { user, onClick } = row({ shortcut: "Ctrl N" });
    await user.click(screen.getByRole("button", { name: "Review a pull request" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not act when disabled, and gives the reason instead of the sub", async () => {
    const { user, onClick } = row({
      sub: "Not read yet",
      disabledReason: "Add a repository first",
    });
    const button = screen.getByRole("button", {
      name: "Review a pull request",
      description: "Add a repository first",
    });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("Not read yet")).not.toBeInTheDocument();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

const NOW = Date.parse("2026-09-24T14:10:00Z");

const LINE = {
  title: "Platform Roadmap",
  summary: "46 open cards · api, billing",
  reading: { text: "read 2m ago", tone: "quiet", shimmer: false },
  label: "Platform Roadmap, 46 open cards, read 2m ago",
  blockers: [],
} as const;

function board(props: Partial<BoardStartRowProps> = {}) {
  const handlers = {
    onOpen: vi.fn(),
    onRetryRead: vi.fn(),
    onClone: vi.fn(),
    onChangePath: vi.fn(),
  };
  const rendered = renderWithStore(
    <BoardStartRow line={LINE} now={NOW} {...handlers} {...props} />,
  );
  return { ...rendered, ...handlers };
}

describe("BoardStartRow", () => {
  it("is a button named by the line, with the age of the reading on the right", async () => {
    const { user, onOpen } = board();
    const button = screen.getByRole("button", { name: LINE.label });
    expect(button).toHaveTextContent("read 2m ago");
    await user.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("says a failed reading as the product's age, with its times in the tooltip", async () => {
    const { user } = board({
      line: {
        ...LINE,
        reading: {
          text: "Read failed 18m ago",
          tone: "failed",
          shimmer: false,
          failure: { failedAt: "2026-09-24T13:52:00Z", readAt: "2026-09-24T11:30:00Z" },
        },
      },
    });
    await user.hover(screen.getByText("Read failed 18m ago"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /^Failed at \d\d:\d\d · last read at \d\d:\d\d$/,
    );
  });

  it("offers Try again for a reading that failed, and Reading… while it runs", async () => {
    const failed: BlockerView = {
      kind: "read-failed",
      message: "gh: rate limited",
      reading: false,
    };
    const { user, onRetryRead, rerender } = board({
      line: { ...LINE, blockers: [failed] },
    });
    expect(screen.getByText("gh: rate limited")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryRead).toHaveBeenCalledTimes(1);
    rerender(
      <BoardStartRow
        line={{ ...LINE, blockers: [{ ...failed, reading: true }] }}
        now={NOW}
        onOpen={() => {}}
        onRetryRead={() => {}}
        onClone={() => {}}
        onChangePath={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Reading…");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("clones a repository, and says Cloning once while it runs, with the spinner in place of Clone", async () => {
    const blocker: BlockerView = {
      kind: "not-cloned",
      repositoryId: "r1",
      text: "acme/api isn't cloned. Its cards can't start a task yet.",
      cloning: false,
      error: "",
    };
    const { user, onClone, rerender } = board({ line: { ...LINE, blockers: [blocker] } });
    await user.click(screen.getByRole("button", { name: "Clone" }));
    expect(onClone).toHaveBeenCalledWith("r1");
    rerender(
      <BoardStartRow
        line={{ ...LINE, blockers: [{ ...blocker, text: "Cloning acme/api…", cloning: true }] }}
        now={NOW}
        onOpen={() => {}}
        onRetryRead={() => {}}
        onClone={() => {}}
        onChangePath={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cloning acme/api…");
    expect(screen.getAllByText(/Cloning/)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Clone" })).not.toBeInTheDocument();
  });

  it("says a clone that failed and offers Try again", async () => {
    const { user, onClone } = board({
      line: {
        ...LINE,
        blockers: [
          {
            kind: "not-cloned",
            repositoryId: "r1",
            text: "gh: no access",
            cloning: false,
            error: "gh: no access",
          },
        ],
      },
    });
    expect(screen.getByText("gh: no access")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onClone).toHaveBeenCalledWith("r1");
  });

  it("changes the path of a missing clone and says the refusal under the line", async () => {
    const { user, onChangePath } = board({
      line: {
        ...LINE,
        blockers: [{ kind: "clone-missing", repositoryId: "r2", text: "The clone is missing" }],
      },
      changePathError: { repositoryId: "r2", message: "That folder isn't acme/web" },
    });
    await user.click(screen.getByRole("button", { name: "Change path…" }));
    expect(onChangePath).toHaveBeenCalledWith("r2");
    expect(screen.getByRole("alert")).toHaveTextContent("That folder isn't acme/web");
  });
});

describe("NoBoardRow", () => {
  it("is a group, not a button, with the names and the clone lines", async () => {
    const onClone = vi.fn();
    const { user } = renderWithStore(
      <NoBoardRow
        names="docs, tools"
        blockers={[
          {
            kind: "not-cloned",
            repositoryId: "r3",
            text: "acme/docs isn't cloned.",
            cloning: false,
            error: "",
          },
        ]}
        onClone={onClone}
        onChangePath={() => {}}
      />,
    );
    const group = screen.getByRole("group", { name: "Repositories without a board" });
    expect(group).toHaveTextContent("No board");
    expect(group).toHaveTextContent("docs, tools");
    expect(within(group).getAllByRole("button")).toHaveLength(1);
    await user.click(within(group).getByRole("button", { name: "Clone" }));
    expect(onClone).toHaveBeenCalledWith("r3");
  });
});
