import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupEpicDialog } from "@/features/discussion/GroupEpicDialog";
import { api, type Draft } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeState } from "@/test/wails-mock";

const REPOSITORIES = [
  { id: "repo-1", fullName: "dev/web", cloned: true, missing: false },
  { id: "repo-2", fullName: "dev/api", cloned: true, missing: false },
];

function loose(): Draft[] {
  return [
    makeDraft({
      id: "a",
      position: 1,
      title: "Alpha",
      repositoryId: "repo-1",
      repository: "dev/web",
    }),
    makeDraft({
      id: "b",
      position: 2,
      title: "Beta",
      repositoryId: "repo-1",
      repository: "dev/web",
    }),
    makeDraft({
      id: "c",
      position: 3,
      title: "Gamma",
      repositoryId: "repo-2",
      repository: "dev/api",
    }),
  ];
}

function draw(drafts: Draft[] = loose()) {
  const discussion = makeDiscussion({ drafts, round: 1, repositories: REPOSITORIES });
  const onOpenChange = vi.fn();
  const view = renderWithStore(
    <GroupEpicDialog discussion={discussion} open onOpenChange={onOpenChange} />,
    { state: makeState({ discussions: [discussion] }) },
  );
  return { ...view, discussion, onOpenChange };
}

const group = (count: number) =>
  screen.getByRole("button", { name: new RegExp(`^Group ${count} drafts`) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GroupEpicDialog", () => {
  it("opens on the title, with the first two drafts picked and the reason in the footer", async () => {
    draw();

    expect(screen.getByRole("dialog", { name: "Group drafts into an epic" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Title of the epic" })).toHaveFocus(),
    );
    expect(screen.getByRole("checkbox", { name: /Alpha/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Beta/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Gamma/ })).not.toBeChecked();
    expect(group(2)).toHaveAttribute("aria-disabled", "true");
    expect(group(2)).toHaveAccessibleDescription("Name the epic to group the drafts.");
  });

  it("says to pick two drafts or more once the epic has a title", async () => {
    const { user } = draw();

    await user.type(screen.getByRole("textbox", { name: "Title of the epic" }), "Pricing");
    expect(group(2)).not.toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("checkbox", { name: /Beta/ }));

    expect(group(1)).toHaveAccessibleDescription("Pick two drafts or more.");
  });

  it("refuses a title above 256 characters by code point", async () => {
    const { user } = draw();
    const title = screen.getByRole("textbox", { name: "Title of the epic" });

    await user.click(title);
    await user.paste("🙂".repeat(257));

    expect(
      within(screen.getByRole("dialog")).getAllByText(
        "Use at most 256 characters in the title of the epic.",
      ).length,
    ).toBeGreaterThan(0);
    expect(group(2)).toHaveAttribute("aria-disabled", "true");
  });

  it("follows the repository of the drafts picked until the user chooses one", async () => {
    const { user } = draw();
    const repository = (name: string) => screen.getByRole("button", { name });
    expect(repository("Repository of the epic: dev/web")).toBeInTheDocument();

    // Beta (dev/web) and Gamma (dev/api) tie: the first by owner/name wins.
    await user.click(screen.getByRole("checkbox", { name: /Alpha/ }));
    await user.click(screen.getByRole("checkbox", { name: /Gamma/ }));
    expect(repository("Repository of the epic: dev/api")).toBeInTheDocument();

    await user.click(repository("Repository of the epic: dev/api"));
    await user.click(await screen.findByRole("menuitemradio", { name: "dev/web" }));
    await user.click(screen.getByRole("checkbox", { name: /Gamma/ }));
    await user.click(screen.getByRole("checkbox", { name: /Alpha/ }));

    expect(repository("Repository of the epic: dev/web")).toBeInTheDocument();
  });

  it("groups the picked drafts, asks the card for the epic and closes", async () => {
    vi.mocked(api.groupIntoEpic).mockResolvedValueOnce("draft-epic");
    const { user, onOpenChange } = draw();

    await user.type(screen.getByRole("textbox", { name: "Title of the epic" }), "Pricing tiers");
    await user.click(group(2));

    expect(api.groupIntoEpic).toHaveBeenCalledExactlyOnceWith(
      "discussion-1",
      ["a", "b"],
      "Pricing tiers",
      "repo-1",
    );
    expect(useAppStore.getState().draftRequest).toEqual({
      discussionId: "discussion-1",
      draftId: "draft-epic",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("groups with Ctrl+Enter", async () => {
    const { user } = draw();

    await user.type(screen.getByRole("textbox", { name: "Title of the epic" }), "Pricing tiers");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.groupIntoEpic).toHaveBeenCalledTimes(1);
  });

  it("does not group with Ctrl+Enter while the reason stands", async () => {
    const { user } = draw();

    await user.click(screen.getByRole("textbox", { name: "Title of the epic" }));
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.groupIntoEpic).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with the refusal of the Go side in its footer", async () => {
    vi.mocked(api.groupIntoEpic).mockRejectedValueOnce(new Error("A publication is running."));
    const { user, onOpenChange } = draw();

    await user.type(screen.getByRole("textbox", { name: "Title of the epic" }), "Pricing tiers");
    await user.click(group(2));

    expect(await screen.findByRole("alert")).toHaveTextContent("A publication is running.");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(useAppStore.getState().draftRequest).toBeNull();
    expect(useAppStore.getState().error).toBeNull();
  });

  it("keeps Cancel, × and Esc inert while it groups, and groups once", async () => {
    let finish: (id: string) => void = () => {};
    vi.mocked(api.groupIntoEpic).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onOpenChange } = draw();

    await user.type(screen.getByRole("textbox", { name: "Title of the epic" }), "Pricing tiers");
    await user.click(group(2));

    const busy = await screen.findByRole("button", { name: "Grouping…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(busy);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(api.groupIntoEpic).toHaveBeenCalledOnce();

    finish("draft-epic");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("starts each opening with an empty title", () => {
    const { rerender, discussion } = draw();
    rerender(<GroupEpicDialog discussion={discussion} open={false} onOpenChange={vi.fn()} />);
    rerender(<GroupEpicDialog discussion={discussion} open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Title of the epic" })).toHaveValue("");
  });
});
