import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsView } from "@/features/settings/SettingsView";
import { api, type Prompt } from "@/lib/wails";
import type { SettingsSection } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";

const TEXT = makePrompt().text;

function view(section: SettingsSection = "defaults") {
  return renderWithStore(<SettingsView />, {
    state: makeState(),
    ui: { location: { kind: "settings", section } },
  });
}

/** promptView opens the PRD prompt and waits for its text to arrive. */
async function promptView(overrides: Partial<Prompt> = {}) {
  vi.mocked(api.getPrompt).mockResolvedValue(makePrompt(overrides));
  const rendered = view("prd");
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

describe("SettingsView", () => {
  it("lists the defaults, the boards, the repositories and the eight prompts in its navigation, with the one on screen as the current page", () => {
    view();

    const nav = screen.getByRole("navigation", { name: "Settings" });
    for (const name of [
      "Defaults",
      "Boards",
      "Repositories",
      "PRD",
      "Tech spec",
      "Plan",
      "One-Shot planning",
      "Step review",
      "Commit",
      "PR",
      "PR review",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(nav).toHaveTextContent("Prompts");
    expect(screen.getByRole("button", { name: "Defaults" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "PRD" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { name: "Defaults" })).toBeInTheDocument();
  });

  it("shows the registered boards in their own section", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Boards" }));

    expect(screen.getByRole("heading", { name: "Boards" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Boards" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Add board" })).toBeInTheDocument();
  });

  it("shows the registered repositories in their own section", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Repositories" }));

    expect(screen.getByRole("heading", { name: "Repositories" })).toBeInTheDocument();
    expect(screen.getByText("dev/web")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Defaults" })).not.toBeInTheDocument();
  });

  it("changes the review mode of new tasks at once", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "New tasks review mode: Manual" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Agent" }));

    expect(api.setReviewModeDefault).toHaveBeenCalledWith("agent");
  });

  it("changes a default at once", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "PR model: Opus 5.5 (1M) · medium" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "low" }));

    expect(api.setModelDefault).toHaveBeenCalledWith("pr", "claude-opus-5-5[1m]", "low");
  });

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

    await user.click(screen.getByRole("button", { name: "Commit" }));

    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    expect(screen.getByText("The edits to the PRD prompt haven't been saved.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.getByRole("textbox", { name: "PRD prompt" })).toHaveValue("Rewritten.");

    await user.click(screen.getByRole("button", { name: "Commit" }));
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
    await user.click(screen.getByRole("button", { name: "Plan" }));

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
