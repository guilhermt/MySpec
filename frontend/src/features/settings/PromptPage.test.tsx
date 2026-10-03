import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsView } from "@/features/settings/SettingsView";
import { api, type Prompt } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";

const EDITED = "2025-09-20T10:00:00Z";

/** promptView opens the PRD prompt in Settings and waits for its text to arrive. */
async function promptView(overrides: Partial<Prompt> = {}) {
  vi.mocked(api.getPrompt).mockResolvedValue(makePrompt(overrides));
  const rendered = renderWithStore(<SettingsView />, {
    state: makeState(),
    ui: { location: { kind: "settings", section: "prd" } },
  });
  await screen.findByTestId("markdown");
  return rendered;
}

describe("PromptPage", () => {
  it("shows the prompt with its name, its description and the way back to the list", async () => {
    await promptView();

    expect(api.getPrompt).toHaveBeenCalledWith("prd");
    expect(screen.getByRole("heading", { level: 2, name: "PRD" })).toBeInTheDocument();
    expect(screen.getByText("Opens the PRD session of a task.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Reset to default…" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Edited/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "MySpec fills the placeholders when a session starts. A session that is running keeps the prompt it started with.",
      ),
    ).toBeInTheDocument();
  });

  it("draws the known placeholders as labels with their tooltip and keeps other code as code", async () => {
    await promptView({ text: "Write {{task_name}} with `{{unknown}}` and `ls`." });

    const markdown = screen.getByTestId("markdown");
    expect(markdown).toHaveTextContent("Write {{task_name}} with ");
    const label = screen.getByText("{{task_name}}");
    expect(label.className).toContain("font-mono");
    expect(screen.getByText("{{unknown}}").tagName).toBe("CODE");
    expect(screen.getByText("ls").tagName).toBe("CODE");
  });

  it("says in a tooltip when the placeholders are filled", async () => {
    const { user } = await promptView({ text: "Write {{task_name}}." });

    await user.hover(screen.getByText("{{task_name}}"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Filled when the session starts");
  });

  it("marks an edited prompt with its date and its lines, and offers the reset", async () => {
    await promptView({ modified: true, editedAt: EDITED, lines: 92, defaultLines: 87 });

    expect(screen.getByText(/^Edited /)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Opens the PRD session of a task. Your version has 92 lines; the default of this version has 87.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to default…" })).toBeEnabled();
  });

  it("holds Edit and Reset to default… with the reason while the prompt is read", async () => {
    vi.mocked(api.getPrompt).mockReturnValue(new Promise(() => {}));
    renderWithStore(<SettingsView />, {
      state: makeState(),
      ui: { location: { kind: "settings", section: "prd" } },
    });

    expect(screen.getByRole("status", { name: "Reading the prompt…" })).toBeInTheDocument();
    const edit = screen.getByRole("button", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-disabled", "true");
    expect(edit).toHaveAccessibleDescription("Reading the prompt…");
    expect(screen.getByRole("button", { name: "Reset to default…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("says why the reading failed, holds the actions with that reason and reads again", async () => {
    vi.mocked(api.getPrompt).mockRejectedValueOnce(new Error("disk is full"));
    vi.mocked(api.getPrompt).mockResolvedValue(makePrompt());
    const { user } = renderWithStore(<SettingsView />, {
      state: makeState(),
      ui: { location: { kind: "settings", section: "prd" } },
    });

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("Couldn't read the PRD prompt");
    expect(notice).toHaveTextContent("disk is full");
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAccessibleDescription(
      "disk is full",
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("markdown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled();
  });

  it("puts the focus on the title when it opens from the list", async () => {
    await promptView();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "PRD" })).toHaveFocus(),
    );
  });

  it("goes back to the list with the focus on the row of the prompt", async () => {
    vi.mocked(api.getPrompt).mockResolvedValue(makePrompt({ stage: "commit" }));
    const { user } = renderWithStore(<SettingsView />, {
      state: makeState(),
      ui: { location: { kind: "settings", section: "prompts" } },
    });

    await user.click(screen.getByRole("link", { name: /^Commit/ }));
    await screen.findByTestId("markdown");
    await user.click(screen.getByRole("button", { name: "Prompts" }));

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "prompts" });
    await waitFor(() => expect(screen.getByRole("link", { name: /^Commit/ })).toHaveFocus());
    expect(useAppStore.getState().promptReturn).toBeNull();
  });

  it("resets the prompt after the dialog and puts the focus on Edit", async () => {
    const { user } = await promptView({ modified: true, editedAt: EDITED });

    await user.click(screen.getByRole("button", { name: "Reset to default…" }));
    await user.click(await screen.findByRole("button", { name: "Reset prompt" }));

    expect(api.restorePrompt).toHaveBeenCalledWith("prd");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Reset to default…" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus());
    expect(screen.queryByText(/^Edited /)).not.toBeInTheDocument();
  });

  it("opens the editor from Edit and returns to the page with the focus on Edit after a save", async () => {
    const { user } = await promptView();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const field = await screen.findByRole("textbox", { name: "PRD prompt" });
    await user.clear(field);
    await user.type(field, "Rewritten.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.savePrompt).toHaveBeenCalledWith("prd", "Rewritten.");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("Rewritten.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Reset to default…" })).toBeInTheDocument();
  });
});
