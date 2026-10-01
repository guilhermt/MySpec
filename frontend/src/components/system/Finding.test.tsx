import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { type DecidableFindingProps, Finding, type FindingView } from "./Finding";

function view(overrides: Partial<FindingView> = {}): FindingView {
  return {
    id: "2",
    number: 2,
    name: "Finding 2 of 3: The form never saves. GeneralForm.tsx, line 84. Approved.",
    title: "The form never saves",
    locationAsTitle: false,
    location: {
      kind: "anchored",
      text: "web/src/settings/GeneralForm.tsx:84",
      url: "https://github.com/dev/web/pull/7/files#diff-abR84",
      line: 84,
      fileName: "GeneralForm.tsx",
    },
    text: "The submit handler drops the value.",
    decision: "approved",
    disabled: "Inline comment · published 13:41",
    ...overrides,
  };
}

describe("Finding", () => {
  it("names itself, says what it says and where it went", () => {
    renderWithStore(
      <Finding
        model={view()}
        current={false}
        onOpenLine={vi.fn()}
        onOpenEditor={vi.fn()}
        renderText={(text) => <p>{text}</p>}
      />,
    );

    const group = screen.getByRole("group", { name: view().name });
    expect(group).toHaveAttribute("data-finding-id", "2");
    expect(group).toHaveAttribute("data-disabled");
    expect(screen.getByText("The form never saves")).toBeInTheDocument();
    expect(screen.getByText("The submit handler drops the value.")).toBeInTheDocument();
    expect(screen.getByText("Inline comment · published 13:41")).toBeInTheDocument();
  });

  it("opens the line on GitHub when its location is clicked", async () => {
    const onOpenLine = vi.fn();
    renderWithStore(
      <Finding
        model={view()}
        current={false}
        onOpenLine={onOpenLine}
        onOpenEditor={vi.fn()}
        renderText={(text) => <p>{text}</p>}
      />,
    );

    await userEvent.click(
      screen.getByRole("link", { name: "web/src/settings/GeneralForm.tsx:84" }),
    );

    expect(onOpenLine).toHaveBeenCalledTimes(1);
  });

  it("draws a general finding without a link", () => {
    renderWithStore(
      <Finding
        model={view({
          location: { kind: "general", text: "General · not on a line of the diff" },
          disabled: null,
        })}
        current={false}
        onOpenLine={vi.fn()}
        onOpenEditor={vi.fn()}
        renderText={(text) => <p>{text}</p>}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("General · not on a line of the diff")).toBeInTheDocument();
    expect(screen.getByRole("group")).not.toHaveAttribute("data-disabled");
  });

  describe("while it is decided on", () => {
    function open(
      overrides: Partial<DecidableFindingProps> = {},
      model: Partial<FindingView> = {},
    ) {
      const props = {
        onDecide: vi.fn(),
        onEdit: vi.fn(),
        onDraftChange: vi.fn(),
        onDraftBlur: vi.fn(),
        onDone: vi.fn(),
        onOpenLine: vi.fn(),
        onOpenEditor: vi.fn(),
        onRetry: vi.fn(),
      };
      renderWithStore(
        <Finding
          model={view({ decision: "", disabled: null, ...model })}
          current
          editNote="Saved as you type. It goes to GitHub as you leave it."
          editing={false}
          draft=""
          saving={false}
          error={null}
          renderText={(text) => <p>{text}</p>}
          {...props}
          {...overrides}
        />,
      );
      return props;
    }

    it("approves, discards and undoes with a click", async () => {
      const props = open();
      await userEvent.click(screen.getByRole("button", { name: "Approve" }));
      await userEvent.click(screen.getByRole("button", { name: "Discard" }));

      expect(props.onDecide.mock.calls).toEqual([["approved"], ["discarded"]]);
    });

    it("writes A, D and E on Approve, Discard and Edit, out of their names", () => {
      open();

      expect(screen.getByRole("button", { name: "Approve" })).toHaveTextContent(/^ApproveA$/);
      expect(screen.getByRole("button", { name: "Discard" })).toHaveTextContent(/^DiscardD$/);
      expect(screen.getByRole("button", { name: "Edit" })).toHaveTextContent(/^EditE$/);
    });

    it("undoes the decision it already holds", async () => {
      const props = open({}, { decision: "approved" });

      expect(screen.getByRole("button", { name: "Approve" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByText("Approved · click again to undo")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Approve" }));

      expect(props.onDecide).toHaveBeenCalledWith("");
    });

    it("says it is saving and offers to try a failed save again", async () => {
      const props = open({ saving: true, error: "text" });

      expect(screen.getByText("Saving…")).toBeInTheDocument();
      expect(screen.getByText(/Couldn't save the text/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(props.onRetry).toHaveBeenCalledTimes(1);
    });

    it("edits with E, opens the line with O and the editor with Ctrl+E", async () => {
      const props = open();
      screen.getByRole("group").focus();

      await userEvent.keyboard("e");
      await userEvent.keyboard("o");
      await userEvent.keyboard("{Control>}e{/Control}");

      expect(props.onEdit).toHaveBeenCalledTimes(1);
      expect(props.onOpenLine).toHaveBeenCalledTimes(1);
      expect(props.onOpenEditor).toHaveBeenCalledTimes(1);
    });

    it("leaves A and D to the card around it", async () => {
      const props = open();
      screen.getByRole("group").focus();

      await userEvent.keyboard("ad");

      expect(props.onDecide).not.toHaveBeenCalled();
    });

    it("opens the editor on its own line with a named button", async () => {
      const props = open();

      await userEvent.click(
        screen.getByRole("button", { name: "Open line 84 of GeneralForm.tsx in VS Code" }),
      );

      expect(props.onOpenEditor).toHaveBeenCalledTimes(1);
    });
  });

  describe("while it is edited", () => {
    function edit(draft: string) {
      const onDone = vi.fn();
      const onDraftChange = vi.fn();
      const onEdit = vi.fn();
      renderWithStore(
        <Finding
          model={view({ decision: "", disabled: null })}
          current
          editNote="Saved as you type. It goes to GitHub as you leave it."
          editing
          draft={draft}
          saving={false}
          error={null}
          onDecide={vi.fn()}
          onDone={onDone}
          onDraftChange={onDraftChange}
          onDraftBlur={vi.fn()}
          onEdit={onEdit}
          onOpenLine={vi.fn()}
          onOpenEditor={vi.fn()}
          onRetry={vi.fn()}
          renderText={(text) => <p>{text}</p>}
        />,
      );
      return { onDone, onDraftChange, onEdit };
    }

    it("puts the focus in the field and reports what is typed", async () => {
      const { onDraftChange } = edit("");
      const field = screen.getByRole("textbox", { name: "Text of finding 2" });

      expect(field).toHaveFocus();
      await userEvent.type(field, "x");

      expect(onDraftChange).toHaveBeenCalledWith("x");
    });

    it("keeps the keys of the card out of the field", async () => {
      const { onEdit } = edit("a");

      await userEvent.type(screen.getByRole("textbox"), "eo");

      expect(onEdit).not.toHaveBeenCalled();
    });

    it("finishes with Esc or Done and gives the focus back to the finding", async () => {
      const { onDone } = edit("Drops the value.");

      await userEvent.keyboard("{Escape}");
      expect(screen.getByRole("group")).toHaveFocus();
      await userEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(onDone).toHaveBeenCalledTimes(2);
    });

    it("asks for a text when the field is empty", () => {
      edit("");

      expect(screen.getByRole("textbox")).toBeInvalid();
      expect(screen.getByText("Write the finding, or discard it.")).toBeInTheDocument();
    });
  });

  it("takes the location for the title and draws no decision once disabled", () => {
    renderWithStore(
      <Finding
        model={view({ locationAsTitle: true })}
        current={false}
        onOpenLine={vi.fn()}
        onOpenEditor={vi.fn()}
        renderText={(text) => <p>{text}</p>}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("keeps only O and Ctrl+E once disabled, and no tab stop of its own", async () => {
    const onOpenLine = vi.fn();
    const onOpenEditor = vi.fn();
    renderWithStore(
      <Finding
        model={view()}
        current={false}
        onOpenLine={onOpenLine}
        onOpenEditor={onOpenEditor}
        renderText={(text) => <p>{text}</p>}
      />,
    );
    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("tabindex", "-1");
    group.focus();

    await userEvent.keyboard("eo{Control>}e{/Control}");

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onOpenLine).toHaveBeenCalledTimes(1);
    expect(onOpenEditor).toHaveBeenCalledTimes(1);
  });
});
