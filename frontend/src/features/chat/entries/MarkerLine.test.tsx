import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import type { MarkerView } from "@/features/chat/markers";
import type { ChecksReading } from "@/lib/pull-requests";
import { api } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makePRCheck,
  makeReviewPass,
  makeReviewSummary,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const AT = "2026-09-28T14:19:00Z";
const TIME = clockTime(AT, Date.now());

const view = (fields: Partial<MarkerView>): MarkerView => ({
  icon: "file",
  text: "Written PRD.md",
  complement: "",
  body: { kind: "none" },
  timeHidden: false,
  ...fields,
});

const task = makeTask({ hasPrd: true, artifactVersion: 2 });

function line(marker: MarkerView, props: { requested?: boolean; onRequested?: () => void } = {}) {
  return renderWithStore(<MarkerLine view={marker} createdAt={AT} task={task} {...props} />, {
    state: makeState({ tasks: [task] }),
    ui: { location: { kind: "task", id: task.id } },
  });
}

describe("MarkerLine", () => {
  it("is read without a stop on the path when it opens nothing, its time in the name", () => {
    line(view({ icon: "commit", text: "Committed c19f02e", complement: "Add the limiter" }));

    const marker = screen.getByRole("article", {
      name: `Committed c19f02e · Add the limiter, ${TIME}`,
    });
    expect(marker).not.toHaveAttribute("data-feed-item");
    expect(marker).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(marker).toHaveTextContent(TIME);
  });

  it("never shows the time of a retry, which keeps it in the name", () => {
    line(
      view({
        icon: "retry",
        text: "Retried on its own",
        complement: "the API was overloaded · 2 attempts",
        timeHidden: true,
      }),
    );

    const marker = screen.getByRole("article", {
      name: `Retried on its own · the API was overloaded · 2 attempts, ${TIME}`,
    });
    expect(marker).not.toHaveTextContent(TIME);
  });

  it("opens the Markdown sent in place, folded at first", async () => {
    const { user } = line(
      view({
        icon: "product",
        text: "MySpec → Implementer",
        complement: "Review 1 · 2 findings · round 1 of 3",
        body: { kind: "markdown", text: "## Findings" },
      }),
    );

    // The line is the stop of the walk, with the state of the fold, and has the name of its entry.
    const name = `MySpec → Implementer · Review 1 · 2 findings · round 1 of 3, ${TIME}`;
    const toggle = screen.getByRole("button", { name });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("data-feed-toggle");
    expect(toggle).toHaveAttribute("data-feed-item");
    expect(screen.getByRole("article", { name })).toContainElement(toggle);
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("markdown")).toHaveTextContent("## Findings");
  });

  it("lists the problems of the plan, each file in mono before its message", async () => {
    const { user } = line(
      view({
        icon: "problem",
        text: "The plan is still invalid",
        complement: "2 problems",
        body: {
          kind: "problems",
          problems: [
            { file: "", message: "no step files were written" },
            { file: "2-api.md", message: "no repository" },
          ],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /The plan is still invalid/ }));

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "no step files were written",
      "2-api.md · no repository",
    ]);
    expect(screen.getByText("2-api.md")).toHaveClass("font-mono");
  });

  it("reads a document on opening, with the way to the panel that holds it", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# The PRD");
    const { user } = line(
      view({ body: { kind: "artifact", name: "PRD.md", openIn: "artifacts" } }),
    );
    expect(api.readArtifact).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Written PRD.md/ }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# The PRD");
    expect(api.readArtifact).toHaveBeenCalledWith(task.id, "PRD.md");

    await user.click(screen.getByRole("button", { name: "Open in Artifacts" }));

    expect(useAppStore.getState()).toMatchObject({ panel: "artifacts", panelDocument: "PRD.md" });
  });

  it("shows a step file without its metadata header, and a report opens in Details", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("---\nrepository: web\n---\n# Step 3\n");
    const { user } = line(
      view({
        icon: "start",
        text: "Started with",
        complement: "steps/03-token-bucket.md",
        body: { kind: "artifact", name: "steps/03-token-bucket.md", openIn: "artifacts" },
      }),
    );

    await user.click(screen.getByRole("button", { name: /Started with/ }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent(/^# Step 3$/);
  });

  it("glows on the line while it reads", async () => {
    vi.mocked(api.readArtifact).mockReturnValue(new Promise(() => {}));
    const { user } = line(
      view({ body: { kind: "artifact", name: "step-reviews/3-1.md", openIn: "details" } }),
    );

    await user.click(screen.getByRole("button", { name: /Written PRD.md/ }));

    expect(screen.getByText("Written PRD.md")).toHaveClass("shimmer-text");
    expect(screen.queryByRole("button", { name: "Open in Details" })).not.toBeInTheDocument();
  });

  it("says a document couldn't be read, and reads it again on Try again", async () => {
    vi.mocked(api.readArtifact)
      .mockRejectedValueOnce(new Error("no such file"))
      .mockResolvedValueOnce("# Findings");
    const { user } = line(
      view({ body: { kind: "artifact", name: "step-reviews/3-1.md", openIn: "details" } }),
    );

    const toggle = screen.getByRole("button", { name: /Written PRD.md/ });
    await user.click(toggle);

    expect(await screen.findByText("Couldn't read step-reviews/3-1.md")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    // Try again goes while the document reloads: the line keeps the focus.
    expect(toggle).toHaveFocus();
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Findings");
    await user.click(screen.getByRole("button", { name: "Open in Details" }));
    expect(useAppStore.getState()).toMatchObject({
      panel: "details",
      panelDocument: "step-reviews/3-1.md",
    });
  });

  it("opens and takes the focus when the request bar asks for it, and settles the request", () => {
    const onRequested = vi.fn();
    line(
      view({
        icon: "problem",
        text: "The plan is still invalid",
        complement: "1 problem",
        body: { kind: "problems", problems: [{ file: "2-api.md", message: "no repository" }] },
      }),
      { requested: true, onRequested },
    );

    const toggle = screen.getByRole("button", { name: /The plan is still invalid/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveFocus();
    expect(onRequested).toHaveBeenCalledOnce();
  });

  describe("in a review", () => {
    const review = makeReviewSummary({
      passes: [makeReviewPass({ pass: 2, file: "review-2.md", revision: 3 })],
    });

    function inReview(marker: MarkerView) {
      return renderWithStore(<MarkerLine view={marker} createdAt={AT} review={review} />, {
        state: makeState({ reviews: [review] }),
        ui: { location: { kind: "review", id: review.id } },
      });
    }

    it("reads the report of a pass from the review, with the way to Reports", async () => {
      vi.mocked(api.readReviewArtifact).mockResolvedValue("## Two things");
      const { user } = inReview(
        view({
          text: "Review 2 written",
          body: { kind: "artifact", name: "review-2.md", openIn: "reports" },
        }),
      );
      expect(api.readReviewArtifact).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: /Review 2 written/ }));

      expect(await screen.findByTestId("markdown")).toHaveTextContent("## Two things");
      expect(api.readReviewArtifact).toHaveBeenCalledWith(review.id, "review-2.md");
      expect(api.readArtifact).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Open in Reports" }));

      expect(useAppStore.getState()).toMatchObject({
        panel: "reports",
        panelDocument: "review-2.md",
      });
    });

    it("lists the checks the pass started from, each with its state and duration", async () => {
      const reading: ChecksReading = {
        checks: [
          makePRCheck({ name: "lint", state: "passed" }),
          makePRCheck({ name: "e2e", state: "failed", conclusion: "failure" }),
        ],
        mergeable: "mergeable",
        checkedAt: AT,
        base: "dev",
      };
      const { user } = inReview(
        view({
          icon: "checks",
          text: "Checks read before pass 2",
          body: { kind: "checks", reading, summary: "1 of 2 passed · 1 failed · merges clean" },
        }),
      );

      await user.click(screen.getByRole("button", { name: /Checks read before pass 2/ }));

      expect(screen.getByText("1 of 2 passed · 1 failed · merges clean")).toBeInTheDocument();
      expect(screen.getByText("lint")).toBeInTheDocument();
      expect(screen.getByText("e2e")).toBeInTheDocument();
    });

    it("lists the findings of a decided pass, disabled, with where each went", async () => {
      const { user } = inReview(
        view({
          icon: "check",
          text: "You decided",
          complement: "1 approved · 1 discarded",
          body: {
            kind: "findings",
            pass: 1,
            findings: [
              {
                id: "1",
                number: 1,
                name: "Finding 1 of 2: Token. src/login.ts, line 12. Approved.",
                title: "Token",
                locationAsTitle: false,
                location: {
                  kind: "anchored",
                  text: "src/login.ts:12",
                  url: "https://github.com/dev/web/pull/31/files#diff-aR12",
                  line: 12,
                  fileName: "login.ts",
                },
                text: "The token is never cleared.",
                decision: "approved",
                disabled: "Inline comment · published 13:41",
              },
              {
                id: "2",
                number: 2,
                name: "Finding 2 of 2: No test. General. Discarded.",
                title: "No test",
                locationAsTitle: false,
                location: { kind: "general", text: "General · not on a line of the diff" },
                text: "There is no test.",
                decision: "discarded",
                disabled: "Not published",
              },
            ],
          },
        }),
      );

      await user.click(screen.getByRole("button", { name: /You decided/ }));

      const findings = screen.getAllByRole("group");
      expect(findings).toHaveLength(2);
      // The findings of a line add no tab stops to the conversation.
      for (const finding of findings) {
        expect(finding).toHaveAttribute("tabindex", "-1");
      }
      expect(screen.getByText("Inline comment · published 13:41")).toBeInTheDocument();
      expect(screen.getByText("Not published")).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "src/login.ts:12" }));

      expect(api.openExternal).toHaveBeenCalledWith(
        "https://github.com/dev/web/pull/31/files#diff-aR12",
      );
    });

    it("opens the line of a decided finding in the editor with Ctrl+E", async () => {
      const { user } = inReview(
        view({
          icon: "check",
          text: "You decided",
          complement: "1 approved",
          body: {
            kind: "findings",
            pass: 1,
            findings: [
              {
                id: "3",
                number: 3,
                name: "Finding 3 of 3: Token. src/login.ts, line 12. Approved.",
                title: "Token",
                locationAsTitle: false,
                location: {
                  kind: "anchored",
                  text: "src/login.ts:12",
                  url: "https://github.com/dev/web/pull/31/files#diff-aR12",
                  line: 12,
                  fileName: "login.ts",
                },
                text: "The token is never cleared.",
                decision: "approved",
                disabled: "Inline comment · published 13:41",
              },
            ],
          },
        }),
      );

      await user.click(screen.getByRole("button", { name: /You decided/ }));
      screen.getByRole("group").focus();
      await user.keyboard("{Control>}e{/Control}");

      expect(api.openFindingInEditor).toHaveBeenCalledWith(review.id, 1, 3);
    });

    it("lists the new commits and says how many more there were", async () => {
      const { user } = inReview(
        view({
          icon: "commit",
          text: "14 new commits",
          complement: "by rsouza",
          body: {
            kind: "commits",
            commits: [
              { sha: "c19f02e", subject: "Fix the time zone rule" },
              { sha: "ab12cd3", subject: "Cover it" },
            ],
            more: 12,
          },
        }),
      );

      await user.click(screen.getByRole("button", { name: /14 new commits/ }));

      expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "c19f02e Fix the time zone rule",
        "ab12cd3 Cover it",
        "and 12 more",
      ]);
    });

    it("opens the review on GitHub from its link, which is no button inside the line", async () => {
      const { user } = inReview(
        view({
          icon: "pullRequest",
          text: "Published pass 1",
          complement: "Approve · the verdict only",
          link: { label: "GitHub", url: "https://github.com/dev/web/pull/31#r1" },
        }),
      );

      await user.click(screen.getByRole("button", { name: "GitHub" }));

      expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31#r1");
    });
  });

  describe("in a discussion", () => {
    const discussion = { id: "discussion-1", documentRevision: 3 };
    const inDiscussion = (marker: MarkerView) =>
      renderWithStore(<MarkerLine view={marker} createdAt={AT} discussion={discussion} />);

    it("reads the document of the discussion once opened, with its size and the way to Documents", async () => {
      vi.mocked(api.readDiscussionArtifact).mockResolvedValueOnce(
        "# Discussion\n\nThe understanding.",
      );
      const { user } = inDiscussion(
        view({
          text: "Written discussion.md",
          body: { kind: "discussionDocument", name: "discussion.md", text: null },
        }),
      );

      await user.click(screen.getByRole("button", { name: /^Written discussion\.md/ }));

      expect(await screen.findByText("32 characters")).toBeVisible();
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "discussion.md");
      await user.click(screen.getByRole("button", { name: "Open in Documents" }));
      expect(useAppStore.getState().panel).toBe("documents");
    });

    it("shows the text it was given without reading anything", async () => {
      const { user } = inDiscussion(
        view({
          text: "Context",
          body: { kind: "discussionDocument", name: "context.md", text: "The context." },
        }),
      );

      await user.click(screen.getByRole("button", { name: /^Context/ }));

      expect(await screen.findByText("12 characters")).toBeVisible();
      expect(api.readDiscussionArtifact).not.toHaveBeenCalled();
    });

    it("says when the document can't be read and tries again", async () => {
      vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(new Error("gone"));
      const { user } = inDiscussion(
        view({
          text: "Updated discussion.md",
          body: { kind: "discussionDocument", name: "discussion.md", text: null },
        }),
      );

      await user.click(screen.getByRole("button", { name: /^Updated discussion\.md/ }));
      await user.click(await screen.findByRole("button", { name: "Try again" }));

      expect(api.readDiscussionArtifact).toHaveBeenCalledTimes(2);
    });

    it("lists the drafts with their state and links, and draws an error with its own time", async () => {
      const { user } = inDiscussion(
        view({
          text: "Publication stopped",
          tone: "error",
          timeText: "14:29 – 15:12",
          body: {
            kind: "drafts",
            rows: [
              {
                key: "epic",
                glyph: "check",
                prefix: "Epic · ",
                title: "Billing",
                status: "Created billing#479",
                tone: "normal",
                link: { label: "billing#479", url: "https://github.com/acme/billing/issues/479" },
              },
              {
                key: "export",
                glyph: "error",
                prefix: "",
                title: "Export",
                status: "Rate limited",
                tone: "error",
                link: null,
              },
            ],
          },
        }),
      );

      const article = screen.getByRole("article");
      expect(article).toHaveAccessibleName(expect.stringContaining("14:29 – 15:12"));
      await user.click(screen.getByRole("button", { name: /^Publication stopped/ }));

      expect(screen.getByText("Rate limited")).toHaveClass("text-state-error");
      await user.click(screen.getByText("billing#479"));
      expect(api.openExternal).toHaveBeenCalledWith("https://github.com/acme/billing/issues/479");
    });
  });
});
