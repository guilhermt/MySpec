import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { api, type ReviewSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeSituation, makeState } from "@/test/wails-mock";

function header(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary(overrides);
  return renderWithStore(<ReviewHeader review={review} />, {
    state: makeState({ reviews: [review] }),
    ui: { location: { kind: "review", id: review.id } },
  });
}

const stepper = () => screen.getByRole("list", { name: /^Progress/ });
const meter = () => screen.getByRole("meter", { name: "Context" });

// clock writes a time the way the header does for today: 14:52.
function clock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

describe("ReviewHeader", () => {
  it("names the place after the pull request, under the Reviews crumb", () => {
    header();

    expect(
      screen.getByRole("heading", { level: 1, name: "Add the login screen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Reviews");
  });

  it("leaves the number, the repository, the author, the mode and the card to the tree and to Details", () => {
    header({
      card: {
        boardId: "board-1",
        number: 12,
        title: "Add the login screen",
        url: "https://github.com/dev/web/issues/12",
        status: "In review",
      },
    });

    expect(screen.queryByText("#31")).not.toBeInTheDocument();
    expect(screen.queryByText("web")).not.toBeInTheDocument();
    expect(screen.queryByText("alice")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Open card/ })).not.toBeInTheDocument();
  });

  it("holds the pill after the title and its controls on the right in their order", () => {
    header({ sessionStatus: "working" });

    const names = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual([
      "Back",
      "Reviews",
      "Show the hidden levels: Reviews",
      "Pause",
      "Details",
      "Reports",
      "More actions",
    ]);
  });

  it("says the state of the review once, in the pill, with no badge and no dot", () => {
    header({ status: "reviewing", sessionStatus: "working" });

    expect(stepper()).toHaveAccessibleName("Progress · Pass 1 · Reviewer working");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Reviewing")).not.toBeInTheDocument();
  });

  it("names in the pill what the most urgent situation asks", () => {
    header({
      status: "awaiting_decision",
      situations: [
        makeSituation({
          taskId: "review-1",
          kind: "review_report",
          form: "decide",
          place: { kind: "review", stage: "", step: 0 },
        }),
      ],
    });

    expect(stepper()).toHaveAccessibleName("Progress · Pass 1 · waiting for you: decide findings");
  });

  describe("the context meter", () => {
    it("measures the session of the reviewer, who it is in the tooltip", async () => {
      const { user } = header({ contextPercent: 44 });

      expect(meter()).toHaveTextContent("44%");
      await user.hover(meter());
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "Context used by the reviewer: 44%",
      );
    });

    it("says it has no reading yet with …", () => {
      header({ contextPercent: 0 });

      expect(meter()).toHaveTextContent("…");
      expect(meter()).toHaveAttribute("aria-valuetext", "not read yet");
    });

    it("shows — while the session is paused", () => {
      header({ sessionStatus: "paused", contextPercent: 44 });

      expect(meter()).toHaveTextContent("—");
    });

    it("is not there, nor Pause, before the review has a session", () => {
      header({ sessionStage: "" });

      expect(screen.queryByRole("meter")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    });
  });

  describe("Pause", () => {
    it("pauses the conversation of the review with no dialog, saying what it pauses", async () => {
      const { user } = header({ sessionStatus: "working" });
      const button = screen.getByRole("button", { name: "Pause" });

      expect(button).toHaveAccessibleDescription("Pause the review · the session that works stops");
      await user.click(button);

      expect(api.pause).toHaveBeenCalledWith("review-1", "review");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("says Pausing… until the call comes back", async () => {
      let answer: () => void = () => {};
      vi.mocked(api.pause).mockReturnValueOnce(
        new Promise<void>((settle) => {
          answer = settle;
        }),
      );
      const { user } = header({ sessionStatus: "working" });

      await user.click(screen.getByRole("button", { name: "Pause" }));

      expect(screen.getByRole("button", { name: "Pausing…" })).toHaveAttribute("aria-busy", "true");
      answer();
      expect(await screen.findByRole("button", { name: "Pause" })).not.toHaveAttribute("aria-busy");
    });

    it("resumes a paused conversation, saying since when", async () => {
      const at = new Date();
      const { user } = header({ sessionStatus: "paused", pausedAt: at.toISOString() });
      const button = screen.getByRole("button", { name: "Resume" });

      expect(button).toHaveAccessibleDescription(`Resume the review · paused since ${clock(at)}`);
      await user.click(button);

      expect(api.resume).toHaveBeenCalledWith("review-1", "review");
    });

    it("has nothing to pause on a session that stopped on an error, and says why", () => {
      header({ sessionStatus: "error" });

      const button = screen.getByRole("button", { name: "Pause" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(
        "Nothing is running to pause: the reviewer's session stopped with an error. Retry it.",
      );
    });
  });

  it("opens Details and Reports, one in place of the other", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(useAppStore.getState().panel).toBe("details");
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Reports" }));
    expect(useAppStore.getState().panel).toBe("reports");
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps the deletion, Review again and the worktree in the ⋯", async () => {
    const { user } = header();

    expect(screen.queryByRole("button", { name: "Delete review" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));

    for (const name of [
      "Open PR",
      "Refresh PR",
      /^Open in VS Code/,
      /^Review again…/,
      "Delete review…",
    ]) {
      expect(await screen.findByRole("menuitem", { name })).toBeInTheDocument();
    }
  });
});
