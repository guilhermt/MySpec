import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { api, type DiscussionSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeState } from "@/test/wails-mock";

/**
 * measuredPanels lays the resizable panels out, which jsdom does not: an
 * element is as wide as the share of the group its panel has, and the
 * observers of the panels hear about it when the test measures.
 */
function measuredPanels() {
  const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
  const original = globalThis.ResizeObserver;
  vi.stubGlobal(
    "ResizeObserver",
    class implements ResizeObserver {
      private readonly entry: { callback: ResizeObserverCallback; targets: Element[] };
      constructor(callback: ResizeObserverCallback) {
        this.entry = { callback, targets: [] };
        observers.push(this.entry);
      }
      observe(target: Element): void {
        this.entry.targets.push(target);
      }
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    const share = Number.parseFloat(this.style.flexGrow);
    return Number.isNaN(share) ? 0 : share * 10;
  });
  const measure = () => {
    for (const { callback, targets } of observers) {
      const entries = targets.map(
        (target) =>
          ({
            target,
            borderBoxSize: [{ inlineSize: (target as HTMLElement).offsetWidth, blockSize: 0 }],
          }) as unknown as ResizeObserverEntry,
      );
      callback(entries, {} as ResizeObserver);
    }
  };
  const restore = () => {
    width.mockRestore();
    vi.stubGlobal("ResizeObserver", original);
  };
  return { measure, restore };
}

function view(overrides: Partial<DiscussionSummary> = {}) {
  return renderWithStore(<DiscussionView discussionId="discussion-1" />, {
    state: makeState({ discussions: [makeDiscussion(overrides)] }),
  });
}

describe("DiscussionView", () => {
  it("puts the header, the bar, the conversation and the documents together", async () => {
    view();

    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Discussing");
    expect(screen.getByRole("group", { name: "Documents" })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("discussion-1", "discussion");
    });
  });

  it("folds the documents panel away from the header", async () => {
    const { measure, restore } = measuredPanels();
    try {
      const { user } = view();
      const documents = () => screen.getByRole("button", { name: "Documents" });
      act(measure);
      expect(documents()).toHaveAttribute("aria-pressed", "true");

      await user.click(documents());
      act(measure);

      expect(documents()).toHaveAttribute("aria-pressed", "false");
    } finally {
      restore();
    }
  });

  it("shows nothing at all for a discussion that is no longer there", () => {
    const { container } = renderWithStore(<DiscussionView discussionId="discussion-9" />, {
      state: makeState({ discussions: [makeDiscussion()] }),
    });

    expect(container.querySelector("header")).toBeNull();
  });

  it("lets nothing but the conversation scroll in its panel", () => {
    view();

    const panel = screen.getByRole("textbox").closest("[data-panel]");
    if (panel === null) {
      throw new Error("the field sits in no panel");
    }
    const inner = panel.firstElementChild;
    if (inner === null) {
      throw new Error("the panel has no content");
    }
    expect(inner).toHaveStyle({ overflow: "clip" });
  });
});
