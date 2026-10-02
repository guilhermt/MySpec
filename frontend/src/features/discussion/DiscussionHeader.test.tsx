import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionHeader } from "@/features/discussion/DiscussionHeader";
import { api, type DiscussionSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeDiscussion, makeSituation, makeState } from "@/test/wails-mock";

function header(overrides: Partial<DiscussionSummary> = {}) {
  const discussion = makeDiscussion(overrides);
  return renderWithStore(<DiscussionHeader discussion={discussion} />, {
    state: makeState({ boards: [makeBoard()], discussions: [discussion] }),
    ui: { location: { kind: "discussion", id: discussion.id } },
  });
}

const stepper = () => screen.getByRole("list", { name: /^Progress/ });
const meter = () => screen.getByRole("meter", { name: "Context" });

describe("DiscussionHeader", () => {
  it("names the place after the discussion, under the crumb of its board", () => {
    header();

    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Roadmap");
  });

  it("holds the pill after the title and its controls on the right in their order", () => {
    header({ sessionStatus: "working" });

    const names = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual(
      expect.arrayContaining(["Pause", "Details", "Documents", "More actions"]),
    );
    expect(names.indexOf("Pause")).toBeLessThan(names.indexOf("Details"));
    expect(names.indexOf("Details")).toBeLessThan(names.indexOf("Documents"));
    expect(names.indexOf("Documents")).toBeLessThan(names.indexOf("More actions"));
  });

  it("says the state of the discussion once, in the pill, with no badge and no dot", () => {
    header({ sessionStatus: "working" });

    expect(stepper()).toHaveAccessibleName("Progress · Discussing · Discussion agent working");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("names the round in the pill after the first drafts", () => {
    header({ round: 2, sessionStatus: "idle" });

    expect(stepper()).toHaveAccessibleName("Progress · Round 2 · idle");
  });

  it("names in the pill what the most urgent situation asks", () => {
    header({
      status: "deciding",
      round: 1,
      situations: [
        makeSituation({
          taskId: "discussion-1",
          kind: "drafts",
          place: { kind: "discussion", stage: "", step: 0 },
        }),
      ],
    });

    expect(stepper()).toHaveAccessibleName("Progress · Round 1 · waiting for you: decide drafts");
  });

  describe("the context meter", () => {
    it("measures the session of the discussion", async () => {
      const { user } = header({ contextPercent: 44 });

      expect(meter()).toHaveTextContent("44%");
      await user.hover(meter());
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "Context used by the discussion: 44%",
      );
    });

    it("is not there, nor Pause, before the discussion has a session", () => {
      header({ sessionStage: "" });

      expect(screen.queryByRole("meter")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    });
  });

  describe("Pause", () => {
    it("pauses the conversation of the discussion, saying what it pauses", async () => {
      const { user } = header({ sessionStatus: "working" });
      const button = screen.getByRole("button", { name: "Pause" });

      expect(button).toHaveAccessibleDescription(
        "Pause the discussion · the session that works stops",
      );
      await user.click(button);

      expect(api.pause).toHaveBeenCalledWith("discussion-1", "discussion");
    });

    it("resumes a paused conversation", async () => {
      const { user } = header({ sessionStatus: "paused", pausedAt: "2026-09-16T14:52:00Z" });

      await user.click(screen.getByRole("button", { name: "Resume" }));

      expect(api.resume).toHaveBeenCalledWith("discussion-1", "discussion");
    });

    it("is dashed, with why, when the session stopped with an error", () => {
      header({ lastError: "boom", sessionStatus: "error" });

      expect(screen.getByRole("button", { name: "Pause" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
  });

  describe("the panels", () => {
    it("open Details and Documents, one at a time", async () => {
      const { user } = header();

      await user.click(screen.getByRole("button", { name: "Details" }));
      expect(useAppStore.getState().panel).toBe("details");

      await user.click(screen.getByRole("button", { name: "Documents" }));
      expect(useAppStore.getState().panel).toBe("documents");
    });
  });
});
