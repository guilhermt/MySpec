import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsView } from "@/features/settings/SettingsView";
import { api, type Prompt } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";

const TEXT = makePrompt().text;

/** editorView opens the PRD prompt and its editor. */
async function editorView(overrides: Partial<Prompt> = {}) {
  vi.mocked(api.getPrompt).mockResolvedValue(makePrompt(overrides));
  const rendered = renderWithStore(<SettingsView />, {
    state: makeState(),
    ui: { location: { kind: "settings", section: "prd" } },
  });
  await screen.findByTestId("markdown");
  await rendered.user.click(screen.getByRole("button", { name: "Edit" }));
  const field = await screen.findByRole("textbox", { name: "PRD prompt" });
  return { ...rendered, field };
}

/** edited puts another text in the editor. */
async function edited() {
  const rendered = await editorView();
  await rendered.user.clear(rendered.field);
  await rendered.user.type(rendered.field, "Rewritten.");
  return rendered;
}

describe("PromptEditor", () => {
  it("opens on the text with the cursor at its start, under its title and sentence", async () => {
    const { field } = await editorView();

    expect(field).toHaveValue(TEXT);
    expect(field).toHaveFocus();
    expect(field).toHaveProperty("selectionStart", 0);
    expect(field).toHaveProperty("selectionEnd", 0);
    expect(
      screen.getByRole("heading", { level: 2, name: "Editing the PRD prompt" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Markdown. The placeholders are filled when a session starts."),
    ).toBeInTheDocument();
  });

  it("lists the placeholders of the default with what they become", async () => {
    await editorView();

    const column = screen.getByRole("complementary", { name: "Placeholders" });
    expect(column).toHaveTextContent("The ones the default uses. Move or remove any of them.");
    expect(column).toHaveTextContent("{{task_name}}");
    expect(column).toHaveTextContent("The name of the task");
    expect(column).toHaveTextContent("Without it, the initial context is added at the end.");
  });

  it("says when the default uses no placeholder", async () => {
    await editorView({ placeholders: [] });

    expect(screen.getByText("The default uses none.")).toBeInTheDocument();
  });

  it("holds Save until the text changes, then says there are unsaved changes", async () => {
    const { user, field } = await editorView();

    const save = screen.getByRole("button", { name: /^Save/ });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription("Nothing changed yet.");
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    await user.type(field, "More. ");

    expect(screen.getByRole("button", { name: /^Save/ })).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("saves with Save and goes back to the page with the new text", async () => {
    const { user } = await edited();

    await user.click(screen.getByRole("button", { name: /^Save/ }));

    expect(api.savePrompt).toHaveBeenCalledWith("prd", "Rewritten.");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("Rewritten.");
    expect(screen.queryByRole("textbox", { name: "PRD prompt" })).not.toBeInTheDocument();
  });

  it("saves with Ctrl+S", async () => {
    const { user } = await edited();

    await user.keyboard("{Control>}s{/Control}");

    expect(api.savePrompt).toHaveBeenCalledWith("prd", "Rewritten.");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("Rewritten.");
  });

  it("does not save with Ctrl+S when nothing changed", async () => {
    const { user } = await editorView();

    await user.keyboard("{Control>}s{/Control}");

    expect(api.savePrompt).not.toHaveBeenCalled();
  });

  it("says Saving… while the call runs", async () => {
    vi.mocked(api.savePrompt).mockReturnValue(new Promise(() => {}));
    const { user } = await edited();

    await user.click(screen.getByRole("button", { name: /^Save/ }));

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeInTheDocument();
  });

  it("keeps the text and says why the save failed, and Save tries again", async () => {
    vi.mocked(api.savePrompt).mockRejectedValueOnce(new Error("disk is full"));
    const { user, field } = await edited();

    await user.click(screen.getByRole("button", { name: /^Save/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save the prompt: disk is full",
    );
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(field).toHaveValue("Rewritten.");

    await user.click(screen.getByRole("button", { name: /^Save/ }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("Rewritten.");
  });

  it("leaves without asking when nothing changed, with Cancel and with the back button", async () => {
    const { user } = await editorView();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByTestId("markdown")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus());
    expect(screen.queryByText("Discard your changes?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("button", { name: "PRD" }));

    expect(await screen.findByTestId("markdown")).toBeInTheDocument();
  });

  it("asks before Cancel and the back button lose the changes", async () => {
    const { user, field } = await edited();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    expect(screen.getByText("The edits to the PRD prompt haven't been saved.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(field).toHaveValue("Rewritten.");

    await user.click(screen.getByRole("button", { name: "PRD" }));
    await user.click(await screen.findByRole("button", { name: "Discard" }));

    expect(await screen.findByTestId("markdown")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "PRD prompt" })).not.toBeInTheDocument();
    expect(useAppStore.getState().promptEdit).toBeNull();
  });

  it("asks before another page of Settings loses the changes", async () => {
    const { user } = await edited();

    await user.click(screen.getByRole("link", { name: "Boards" }));

    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "prd" });
  });
});
