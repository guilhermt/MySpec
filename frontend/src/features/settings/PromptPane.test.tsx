import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsView } from "@/features/settings/SettingsView";
import type { SettingsSection } from "@/lib/locations";
import { api, type Prompt } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";

const TEXT = makePrompt().text;

/** openSection opens another page of Settings, as the list of prompts does, asking before an edit is lost. */
function openSection(section: SettingsSection) {
  act(() => useAppStore.getState().selectSettingsSection(section));
}

/** promptView opens the PRD prompt and waits for its text to arrive. */
async function promptView(overrides: Partial<Prompt> = {}) {
  vi.mocked(api.getPrompt).mockResolvedValue(makePrompt(overrides));
  const rendered = renderWithStore(<SettingsView />, {
    state: makeState(),
    ui: { location: { kind: "settings", section: "prd" } },
  });
  await screen.findByTestId("markdown");
  return rendered;
}

/** edited opens the editor of the PRD prompt and puts another text in it. */
async function edited() {
  const rendered = await promptView();
  const { user } = rendered;

  await user.click(screen.getByRole("button", { name: "Edit" }));
  const field = await screen.findByRole("textbox", { name: "PRD prompt" });
  await user.clear(field);
  await user.type(field, "Rewritten.");

  return { ...rendered, field };
}

describe("PromptPane in Settings", () => {
  it("shows a prompt rendered, marked as modified and restorable only when it is", async () => {
    const { unmount } = await promptView();

    expect(api.getPrompt).toHaveBeenCalledWith("prd");
    expect(screen.getByTestId("markdown")).toHaveTextContent("Write the PRD of {{task_name}}.");
    expect(screen.getByText("Opens the PRD session of a task.")).toBeInTheDocument();
    expect(screen.queryByText("Modified")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore default" })).not.toBeInTheDocument();

    unmount();
    await promptView({ modified: true });

    expect(screen.getByText("Modified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore default" })).toBeInTheDocument();
  });

  it("edits a prompt with its placeholders at hand and saves it", async () => {
    const { user } = await promptView();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    const field = await screen.findByRole("textbox", { name: "PRD prompt" });
    expect(field).toHaveValue(TEXT);
    const reference = screen.getByRole("complementary", { name: "Placeholders" });
    expect(reference).toHaveTextContent("{{task_name}}");
    expect(reference).toHaveTextContent("The name of the task");
    expect(reference).toHaveTextContent("Without it, the initial context is added at the end.");

    await user.clear(field);
    await user.type(field, "Rewritten.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.savePrompt).toHaveBeenCalledWith("prd", "Rewritten.");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("Rewritten.");
    expect(screen.getByText("Modified")).toBeInTheDocument();
  });

  it("saves with Ctrl+S", async () => {
    const { user } = await edited();

    await user.keyboard("{Control>}s{/Control}");

    expect(api.savePrompt).toHaveBeenCalledWith("prd", "Rewritten.");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("Rewritten.");
  });

  it("keeps the text and says why when saving fails", async () => {
    vi.mocked(api.savePrompt).mockRejectedValue(new Error("disk is full"));
    const { user, field } = await edited();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("disk is full");
    expect(field).toHaveValue("Rewritten.");
  });

  it("asks before leaving an edit with changes", async () => {
    const { user } = await edited();

    openSection("commit");

    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    expect(screen.getByText("The edits to the PRD prompt haven't been saved.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.getByRole("textbox", { name: "PRD prompt" })).toHaveValue("Rewritten.");

    openSection("commit");
    await user.click(await screen.findByRole("button", { name: "Discard" }));

    expect(await screen.findByRole("heading", { name: "Commit" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "PRD prompt" })).not.toBeInTheDocument();

    // Cancel loses the same text, so it asks the same way.
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(await screen.findByRole("textbox", { name: "Commit prompt" }), " Push it.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByRole("textbox", { name: "Commit prompt" })).not.toBeInTheDocument();
  });

  it("leaves an edit without changes without asking", async () => {
    const { user } = await promptView();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("textbox", { name: "PRD prompt" });
    openSection("plan");

    expect(await screen.findByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.queryByText("Discard your changes?")).not.toBeInTheDocument();
  });

  it("restores the default after a confirmation", async () => {
    const { user } = await promptView({ modified: true });

    await user.click(screen.getByRole("button", { name: "Restore default" }));

    expect(await screen.findByText("Restore the default PRD prompt?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(api.restorePrompt).toHaveBeenCalledWith("prd");
    await waitFor(() => {
      expect(screen.queryByText("Modified")).not.toBeInTheDocument();
    });
  });
});
