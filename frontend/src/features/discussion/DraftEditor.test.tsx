import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftEditor } from "@/features/discussion/DraftEditor";
import { api, type DiscussionSummary, type Draft } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDraft,
  makeDraftRef,
  makeState,
} from "@/test/wails-mock";

function draw(draft: Draft, overrides: Partial<DiscussionSummary> = {}, others: Draft[] = []) {
  const discussion = makeDiscussion({ drafts: [draft, ...others], round: 1, ...overrides });
  const onDone = vi.fn();
  const view = renderWithStore(
    <DraftEditor discussion={discussion} draft={draft} onDone={onDone} />,
    {
      state: makeState({
        discussions: [discussion],
        boards: [
          makeBoard({
            id: "board-1",
            cards: [makeBoardCard({ repository: "dev/web", number: 474, title: "Usage alerts" })],
          }),
        ],
      }),
    },
  );
  return { ...view, discussion, onDone };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DraftEditor, the fields", () => {
  it("edits a card: title, body, the three fields and its dependencies, with the focus on the title", () => {
    draw(makeDraft());

    expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Body" })).toHaveValue(
      "A button that exports the list.",
    );
    expect(screen.getByRole("button", { name: "Repository: dev/web" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Module: No module" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Epic: No epic" })).toBeInTheDocument();
    expect(screen.getByText("Depends on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a dependency" })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Saved as you type\. The agent's next revision of this draft replaces your edits\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("leaves the module, the epic and the dependencies out of an epic", () => {
    draw(makeDraft({ kind: "epic", title: "Pricing tiers" }));

    expect(screen.getByRole("button", { name: "Repository: dev/web" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Module/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Epic/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Depends on")).not.toBeInTheDocument();
  });

  it("leaves the module out of a board without the field", () => {
    draw(makeDraft(), { moduleField: "" });

    expect(screen.queryByRole("button", { name: /^Module/ })).not.toBeInTheDocument();
  });

  it("fixes the repository of an update to the one of the card", () => {
    draw(makeDraft({ kind: "update" }));

    expect(screen.queryByRole("button", { name: /^Repository/ })).not.toBeInTheDocument();
    expect(screen.getByText("dev/web · the card's repository")).toBeInTheDocument();
  });

  it("offers the repository that left the board as an unavailable choice", async () => {
    const { user } = draw(makeDraft({ repositoryId: "", repository: "dev/old" }));

    await user.click(screen.getByRole("button", { name: /^Repository: dev\/old/ }));

    expect(await screen.findByRole("menuitemradio", { name: /dev\/old/ })).toHaveTextContent(
      "not on the board",
    );
  });

  it("changes the repository, the module and the epic from the choices", async () => {
    const epic = makeDraft({ id: "epic-1", kind: "epic", position: 0, title: "Pricing tiers" });
    const { user } = draw(makeDraft({ id: "draft-1", position: 1 }), {}, [epic]);

    await user.click(screen.getByRole("button", { name: "Module: No module" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Billing" }));
    expect(api.setDraftModule).toHaveBeenCalledWith("discussion-1", "draft-1", "Billing");

    await user.click(screen.getByRole("button", { name: "Epic: No epic" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Pricing tiers" }));
    expect(api.setDraftEpic).toHaveBeenCalledWith("discussion-1", "draft-1", "epic-1");
  });

  it("says the approval is cleared by what the user changes, on an approved draft", () => {
    draw(makeDraft({ decision: "approved" }));

    expect(
      screen.getByText(/Changing the repository, the epic or a dependency clears the approval\./),
    ).toBeInTheDocument();
  });
});

describe("DraftEditor, the texts", () => {
  it("never saves a blank title, and says so", async () => {
    const { user } = draw(makeDraft());
    const title = screen.getByRole("textbox", { name: "Title" });

    await user.clear(title);

    expect(title).toBeInvalid();
    expect(screen.getByText("Write a title.")).toBeInTheDocument();
    await user.tab();
    expect(api.setDraftText).not.toHaveBeenCalled();
  });

  it("never saves a blank body of an agent's epic", async () => {
    const { user } = draw(makeDraft({ kind: "epic", title: "Pricing tiers" }));

    await user.clear(screen.getByRole("textbox", { name: "Body" }));

    expect(screen.getByText("Write the body.")).toBeInTheDocument();
    await user.tab();
    expect(api.setDraftText).not.toHaveBeenCalled();
  });

  it("saves the blank body of an epic the user wrote", async () => {
    const { user } = draw(
      makeDraft({ id: "epic-9", kind: "epic", source: "user", title: "Pricing" }),
    );

    await user.clear(screen.getByRole("textbox", { name: "Body" }));
    await user.tab();

    expect(screen.queryByText("Write the body.")).not.toBeInTheDocument();
    expect(api.setDraftText).toHaveBeenCalledExactlyOnceWith(
      "discussion-1",
      "epic-9",
      "Pricing",
      "",
    );
  });
});

describe("DraftEditor, Existing issue…", () => {
  async function openField(user: ReturnType<typeof draw>["user"]) {
    await user.click(screen.getByRole("button", { name: "Epic: No epic" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Existing issue…/ }));
    return screen.findByRole("textbox", { name: "Existing issue" });
  }

  it("takes owner/name#N and puts the card under it", async () => {
    const { user } = draw(makeDraft());
    const field = await openField(user);
    expect(field).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    await user.type(field, "dev/web#3{Enter}");

    expect(api.setDraftEpic).toHaveBeenCalledExactlyOnceWith(
      "discussion-1",
      "draft-1",
      "dev/web#3",
    );
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Existing issue" })).not.toBeInTheDocument(),
    );
  });

  it("is the action of the Epic, apart from its choices, and opens the field with Enter", async () => {
    const { user } = draw(makeDraft());
    await user.click(screen.getByRole("button", { name: "Epic: No epic" }));
    const item = await screen.findByRole("menuitem", {
      name: "Existing issue…. Enter opens it.",
    });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("menuitemradio", { name: /Existing issue/ })).not.toBeInTheDocument();

    item.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("textbox", { name: "Existing issue" })).toHaveFocus();
    expect(api.setDraftEpic).not.toHaveBeenCalled();
  });

  it("shows the refusal under the field and keeps it open", async () => {
    vi.mocked(api.setDraftEpic).mockRejectedValueOnce(new Error("dev/web#3 isn't an epic."));
    const { user } = draw(makeDraft());
    const field = await openField(user);

    await user.type(field, "dev/web#3{Enter}");

    expect(await screen.findByText("dev/web#3 isn't an epic.")).toBeInTheDocument();
    expect(field).toBeInvalid();
  });

  it("closes the field with Esc and not the edit", async () => {
    const { user, onDone } = draw(makeDraft());
    await openField(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Existing issue" })).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("DraftEditor, the dependencies", () => {
  const issue = {
    draft: "",
    key: "dev/web#7",
    reference: "dev/web#7",
    title: "Rate limits",
    url: "",
    linked: false,
    dropped: "",
    detail: "",
  };

  it("shows each dependency as a chip that can be taken out, but the one recorded on GitHub", async () => {
    const { user } = draw(
      makeDraft({
        dependencies: [
          issue,
          { ...issue, key: "dev/web#8", reference: "dev/web#8", title: "Audit", linked: true },
        ],
      }),
    );

    expect(screen.getByRole("button", { name: "Audit" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove the dependency on Audit" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove the dependency on Rate limits" }));

    expect(api.removeDraftDependency).toHaveBeenCalledExactlyOnceWith(
      "discussion-1",
      "draft-1",
      "dev/web#7",
    );
  });

  it("adds a draft of the round or a card of the board from the picker", async () => {
    const other = makeDraft({ id: "draft-2", position: 2, title: "Group the invoices" });
    const { user } = draw(makeDraft(), {}, [other]);

    await user.click(screen.getByRole("button", { name: "Add a dependency" }));
    const list = await screen.findByRole("listbox", { name: "Depend on" });
    expect(screen.getByRole("combobox")).toHaveFocus();
    await user.click(within(list).getByRole("option", { name: /Group the invoices/ }));
    expect(api.addDraftDependency).toHaveBeenCalledWith("discussion-1", "draft-1", "draft-2");

    await user.click(within(list).getByRole("option", { name: /#474 Usage alerts/ }));
    expect(api.addDraftDependency).toHaveBeenLastCalledWith(
      "discussion-1",
      "draft-1",
      "dev/web#474",
    );
  });

  it("shows the refusal of a dependency under the field", async () => {
    vi.mocked(api.addDraftDependency).mockRejectedValueOnce(
      new Error("A draft can't depend on itself."),
    );
    const { user } = draw(makeDraft(), {}, [
      makeDraft({ id: "draft-2", position: 2, title: "Other" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Add a dependency" }));
    await user.click(await screen.findByRole("option", { name: /Other/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A draft can't depend on itself.");
  });

  it("puts a draft in an epic under the epics of the round only", async () => {
    const other = makeDraft({
      id: "epic-2",
      kind: "epic",
      position: 0,
      round: 0,
      title: "Old epic",
    });
    const { user } = draw(
      makeDraft({ epic: makeDraftRef({ draft: "epic-2", title: "Old epic" }) }),
      {},
      [other],
    );

    await user.click(screen.getByRole("button", { name: "Epic: Old epic" }));

    expect(await screen.findByRole("menuitemradio", { name: "Old epic" })).toBeInTheDocument();
  });
});

describe("DraftEditor, during a publication", () => {
  it("reads only, with the reason on every control", () => {
    draw(makeDraft(), { publishing: true });

    expect(screen.getByRole("textbox", { name: "Title" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("textbox", { name: "Body" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /^Repository/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Add a dependency/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getAllByText("A publication is running").length).toBeGreaterThan(0);
  });
});

describe("DraftEditor, Esc", () => {
  it("closes the picker first, and the edit on the next Esc", async () => {
    const { user, onDone } = draw(makeDraft());
    await user.click(screen.getByRole("button", { name: "Add a dependency" }));
    await screen.findByRole("listbox", { name: "Depend on" });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox", { name: "Depend on" })).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();

    await user.click(screen.getByRole("textbox", { name: "Title" }));
    await user.keyboard("{Escape}");

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("closes an open choice first and not the edit", async () => {
    const { user, onDone } = draw(makeDraft());
    await user.click(screen.getByRole("button", { name: "Module: No module" }));
    await screen.findByRole("menu");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(onDone).not.toHaveBeenCalled();
  });

  it("closes with Done", async () => {
    const { user, onDone } = draw(makeDraft());

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
