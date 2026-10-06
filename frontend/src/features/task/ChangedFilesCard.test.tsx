import { fireEvent, screen, within } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useFeed } from "@/features/chat/useFeed";
import { ChangedFilesCard } from "@/features/task/ChangedFilesCard";
import { useFocusRescue } from "@/features/task/request-focus";
import { api, type Review, type ReviewFile } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReview } from "@/test/wails-mock";

const FILES: ReviewFile[] = [
  { path: "internal/limit/bucket.go", kind: "modified", staged: true, partial: false },
  { path: "internal/limit/bucket_test.go", kind: "added", staged: false, partial: true },
  { path: "internal/limit/old.go", kind: "deleted", staged: false, partial: false },
];

// many is a review of the given number of files, none staged.
function many(count: number): Review {
  return makeReview({
    files: Array.from({ length: count }, (_, index) => ({
      path: `src/file-${index + 1}.ts`,
      kind: "modified",
      staged: false,
      partial: false,
    })),
  });
}

// InFeed is the card at the end of a conversation, between a speech and a queued message.
function InFeed({ review }: { review: Review | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useFeed(ref);
  return (
    <div ref={ref} role="feed" aria-label="Conversation">
      <article data-feed-item tabIndex={-1} aria-label="Speech" />
      <ChangedFilesCard taskId="task-1" review={review} />
      <article data-feed-item tabIndex={-1} aria-label="Queued" />
    </div>
  );
}

// Rescued is the card on the task screen, whose rescue takes a lost focus to the composer.
function Rescued({ review }: { review: Review }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusRescue(ref);
  return (
    <div ref={ref}>
      <ChangedFilesCard taskId="task-1" review={review} />
      <textarea id="composer-input" aria-label="Composer" />
    </div>
  );
}

const card = () => screen.getByRole("article", { name: /^Changed files/ });
const row = (path: RegExp) => within(card()).getByRole("button", { name: path });

describe("ChangedFilesCard", () => {
  it("lists each file with its letter, its path and where it stands in the index", () => {
    renderWithStore(<ChangedFilesCard taskId="task-1" review={makeReview({ files: FILES })} />);

    expect(card()).toHaveAccessibleName("Changed files · 3");
    expect(row(/bucket\.go/)).toHaveTextContent("Minternal/limit/bucket.gostaged");
    expect(row(/bucket_test\.go/)).toHaveTextContent("partly staged");
    expect(row(/old\.go/)).toHaveTextContent("Dinternal/limit/old.gonot staged");
  });

  it("opens a file in VS Code", async () => {
    const { user } = renderWithStore(
      <ChangedFilesCard taskId="task-1" review={makeReview({ files: FILES })} />,
    );

    await user.click(row(/bucket\.go/));

    expect(api.openFileInEditor).toHaveBeenCalledWith("task-1", "internal/limit/bucket.go");
  });

  it("says a deleted file has nothing to open, and opens nothing", async () => {
    const { user } = renderWithStore(
      <ChangedFilesCard taskId="task-1" review={makeReview({ files: FILES })} />,
    );

    await user.hover(row(/old\.go/));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "The file was deleted, so there is nothing to open",
    );
    await user.click(row(/old\.go/));

    expect(row(/old\.go/)).toHaveAttribute("aria-disabled", "true");
    expect(api.openFileInEditor).not.toHaveBeenCalled();
  });

  it("names the file a line opens in its tooltip", async () => {
    const { user } = renderWithStore(
      <ChangedFilesCard taskId="task-1" review={makeReview({ files: FILES })} />,
    );

    await user.hover(row(/bucket\.go/));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Open internal/limit/bucket.go in VS Code",
    );
  });

  it("lists twelve files and the way to the others", async () => {
    const { user } = renderWithStore(<ChangedFilesCard taskId="task-1" review={many(15)} />);

    expect(within(card()).getAllByRole("listitem")).toHaveLength(13);
    expect(row(/file-12\.ts/)).toBeInTheDocument();
    expect(within(card()).queryByText("src/file-13.ts")).not.toBeInTheDocument();

    await user.click(within(card()).getByRole("button", { name: "Show 3 more files" }));

    expect(within(card()).getAllByRole("listitem")).toHaveLength(15);
    expect(row(/file-15\.ts/)).toBeInTheDocument();
  });

  it("takes the focus to the first file it shows with Show N more files, not to the composer", async () => {
    const { user } = renderWithStore(<Rescued review={many(15)} />);

    within(card()).getByRole("button", { name: "Show 3 more files" }).focus();
    await user.keyboard("{Enter}");

    expect(row(/file-13\.ts/)).toHaveFocus();
    await new Promise((settle) => setTimeout(settle, 0));
    expect(row(/file-13\.ts/)).toHaveFocus();
  });

  it("stands in with a skeleton before the first reading of the worktree", () => {
    renderWithStore(<ChangedFilesCard taskId="task-1" review={null} />);

    expect(card()).toHaveAccessibleName("Changed files");
    expect(card()).toHaveAttribute("aria-busy", "true");
    expect(within(card()).getByRole("group", { name: "Reading the worktree" })).toBeInTheDocument();
  });

  it("says the worktree couldn't be read, with what git said", () => {
    renderWithStore(
      <ChangedFilesCard
        taskId="task-1"
        review={makeReview({ files: [], error: "fatal: not a git repository" })}
      />,
    );

    expect(card()).toHaveTextContent("Couldn't read the worktree");
    expect(screen.getByText("fatal: not a git repository")).toHaveClass("font-mono");
    expect(within(card()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("walks its lines with the arrows and goes on to the entries around it at its ends", () => {
    renderWithStore(<InFeed review={makeReview({ files: FILES.slice(0, 2) })} />);
    card().focus();

    fireEvent.keyDown(card(), { key: "ArrowDown" });
    expect(row(/bucket\.go/)).toHaveFocus();
    fireEvent.keyDown(row(/bucket\.go/), { key: "ArrowDown" });
    expect(row(/bucket_test\.go/)).toHaveFocus();
    fireEvent.keyDown(row(/bucket_test\.go/), { key: "ArrowDown" });
    expect(screen.getByRole("article", { name: "Queued" })).toHaveFocus();

    card().focus();
    fireEvent.keyDown(card(), { key: "ArrowDown" });
    fireEvent.keyDown(row(/bucket\.go/), { key: "ArrowUp" });
    expect(screen.getByRole("article", { name: "Speech" })).toHaveFocus();
  });

  it("is the one stop of the feed while a line holds the focus", () => {
    renderWithStore(<InFeed review={makeReview({ files: FILES })} />);

    row(/bucket\.go/).focus();

    expect(card()).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("article", { name: "Queued" })).toHaveAttribute("tabindex", "-1");
  });

  it("opens the file of the line with Enter", async () => {
    const { user } = renderWithStore(<InFeed review={makeReview({ files: FILES })} />);
    row(/bucket\.go/).focus();

    await user.keyboard("{Enter}");

    expect(api.openFileInEditor).toHaveBeenCalledWith("task-1", "internal/limit/bucket.go");
  });
});
