import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftsPanel } from "@/features/discussion/DraftsPanel";
import type { DiscussionSummary, Draft } from "@/lib/wails";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeDraftRef, makeState } from "@/test/wails-mock";

function panel(drafts: Draft[], overrides: Partial<DiscussionSummary> = {}) {
  const discussion = makeDiscussion({ drafts, status: "deciding", ...overrides });
  const rendered = renderWithStore(<DraftsPanel discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
  });
  return { ...rendered, discussion };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DraftsPanel", () => {
  it("shows nothing while the discussion wrote no draft", () => {
    const { container } = panel([]);

    expect(container).toBeEmptyDOMElement();
  });

  it("counts how far the user is through the drafts", () => {
    panel([
      makeDraft({ id: "draft-1", position: 1, decision: "approved" }),
      makeDraft({ id: "draft-2", position: 2, title: "Group the invoices" }),
    ]);

    expect(screen.getByText("Drafts")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 decided")).toBeInTheDocument();
  });

  it("opens again when the drafts are read anew", async () => {
    const { user, rerender, discussion } = panel([makeDraft()]);
    await user.click(screen.getByRole("button", { name: /Drafts/ }));
    expect(screen.queryByRole("article", { name: "Draft Export the invoices" })).toBeNull();

    rerender(<DraftsPanel discussion={{ ...discussion, draftsRevision: 2 }} />);

    expect(screen.getByRole("article", { name: "Draft Export the invoices" })).toBeInTheDocument();
  });

  it("puts the epics and the loose drafts in the order they sit in", () => {
    panel([
      makeDraft({ id: "draft-1", position: 1, title: "Export the invoices" }),
      makeDraft({ id: "epic-1", position: 2, kind: "epic", title: "Invoices" }),
      makeDraft({
        id: "draft-2",
        position: 3,
        title: "Group the invoices",
        epic: makeDraftRef({ draft: "epic-1", title: "Invoices" }),
      }),
    ]);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByRole("article")).toHaveAttribute(
      "aria-label",
      "Draft Export the invoices",
    );
    const epic = within(items[1] as HTMLElement).getByRole("region", { name: "Epic Invoices" });
    expect(within(epic).getAllByRole("article")).toHaveLength(2);
  });

  it("groups the drafts the user picked into an epic", async () => {
    const { user } = panel([
      makeDraft({ id: "draft-1", position: 1 }),
      makeDraft({ id: "draft-2", position: 2, title: "Group the invoices" }),
    ]);
    const group = () => screen.getByRole("button", { name: "Group into an epic" });
    expect(group()).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Select draft Export the invoices" }));
    expect(group()).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Select draft Group the invoices" }));
    await user.click(group());

    expect(api.groupIntoEpic).toHaveBeenCalledWith(
      "discussion-1",
      ["draft-1", "draft-2"],
      "Epic",
      "repo-1",
    );
    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", { name: "Select draft Export the invoices" }),
      ).not.toBeChecked();
    });
  });

  it("offers no grouping of a draft the publication already started on", () => {
    panel([
      makeDraft({ outcome: "created", number: 7, url: "https://github.com/dev/web/issues/7" }),
    ]);

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("toolbar", { name: "Grouping" })).toBeNull();
  });
});
