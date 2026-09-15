import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { api, type TaskSummary } from "@/lib/wails";
import { type NodeId, useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeModelDefaults, makeState, makeTask } from "@/test/wails-mock";

const AT_ROOT: { newTaskFor: NodeId } = { newTaskFor: "root" };
const AT_WEB: { newTaskFor: NodeId } = { newTaskFor: "repo:/home/dev/projects/web" };

function open(ui = AT_ROOT, tasks: TaskSummary[] = []) {
  return renderWithStore(<NewTaskDialog />, { state: makeState({ tasks }), ui });
}

describe("NewTaskDialog", () => {
  it("stays closed until a node asks for it", () => {
    renderWithStore(<NewTaskDialog />, { state: makeState() });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says where the task will live", () => {
    open(AT_WEB);

    expect(screen.getByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(screen.getByText("In web")).toBeInTheDocument();
  });

  it("says when the task will live in the workspace root", () => {
    open();

    expect(screen.getByText("At the workspace root")).toBeInTheDocument();
  });

  it("offers the normalised name of what was typed", async () => {
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "Minha Feature!");

    expect(screen.getByText("Use lowercase letters, digits and single hyphens.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: 'Use "minha-feature"' }));

    expect(screen.getByLabelText("Name")).toHaveValue("minha-feature");
    expect(screen.getByText("Lowercase letters, digits and hyphens.")).toBeVisible();
  });

  it("refuses a name another task already has", async () => {
    const { user } = open(AT_ROOT, [makeTask({ name: "add-login" })]);

    await user.type(screen.getByLabelText("Name"), "add-login");

    expect(
      screen.getByText("A task with this name already exists in this workspace."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("keeps Create out of reach until both fields are filled", async () => {
    const { user } = open();
    const create = screen.getByRole("button", { name: "Create" });

    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "add-login");
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText("Initial context"), "   ");
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    expect(create).toBeEnabled();
  });

  it("creates the task in the repository it was opened for and opens it", async () => {
    vi.mocked(api.createTask).mockResolvedValue("task-9");
    const { user } = open(AT_WEB);

    await user.type(screen.getByLabelText("Name"), "fix-header");
    await user.type(screen.getByLabelText("Initial context"), "The header overlaps the menu");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(useAppStore.getState().openTaskId).toBe("task-9");
    });
    expect(api.createTask).toHaveBeenCalledWith({
      name: "fix-header",
      repoPath: "/home/dev/projects/web",
      initialContext: "The header overlaps the menu",
      models: makeModelDefaults(),
      reviewMode: "",
    });
    expect(useAppStore.getState().newTaskFor).toBeNull();
  });

  it("folds the models under a summary of the defaults", () => {
    open();

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent("Defaults");
    expect(screen.queryByRole("button", { name: /PRD model:/ })).not.toBeInTheDocument();
  });

  it("sums up what was adjusted", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(await screen.findByRole("button", { name: "PRD model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent(
      "PRD: Fable 5.1 · xhigh",
    );
    // The menu of the picker is a child popup of the dialog: a click in it
    // leaves the dialog open.
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Plan model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "max" }));

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent(
      "PRD: Fable 5.1 · xhigh +1",
    );
  });

  it("creates the task with the models of the dialog", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(await screen.findByRole("button", { name: "PRD model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));
    await user.keyboard("{Escape}");

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledOnce();
    });
    expect(api.createTask).toHaveBeenCalledWith({
      name: "add-login",
      repoPath: "",
      initialContext: "A login screen",
      models: makeModelDefaults().map((line) =>
        line.stage === "prd" ? { ...line, effort: "xhigh" } : line,
      ),
      reviewMode: "",
    });
  });

  it("creates from the defaults when nothing was adjusted", async () => {
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith({
        name: "add-login",
        repoPath: "",
        initialContext: "A login screen",
        models: makeModelDefaults(),
        reviewMode: "",
      });
    });
  });

  it("submits from the context field with Ctrl+Enter", async () => {
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledOnce();
    });
  });

  it("keeps the form open with the message when creation fails", async () => {
    vi.mocked(api.createTask).mockRejectedValue(new Error("A task with this name already exists."));
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("A task with this name already exists.")).toBeVisible();
    expect(useAppStore.getState().newTaskFor).toBe("root");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("closes without creating anything on Cancel", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(useAppStore.getState().newTaskFor).toBeNull();
    expect(api.createTask).not.toHaveBeenCalled();
  });
});
