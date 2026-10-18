import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { updateBlockOf } from "@/features/about/about";
import { UpdateBlock } from "@/features/about/UpdateBlock";
import type { Update } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  api,
  makeState,
  makeTask,
  makeUpdate,
  makeUpdateInstall,
  makeUpdateInstallFailure,
} from "@/test/wails-mock";

function Host({ update }: { update: Update }) {
  const block = updateBlockOf(update);
  return block.kind === "none" ? null : <UpdateBlock update={update} block={block} />;
}

function Connected() {
  const update = useAppStore((state) => state.app?.update ?? makeUpdate());
  return <Host update={update} />;
}

function block(update: Update, tasks = [makeTask()]) {
  return renderWithStore(<Connected />, { state: makeState({ update, tasks }) });
}

const available = (overrides: Partial<Update> = {}) =>
  makeUpdate({ latest: "0.5.0", ...overrides });

const installed = (working = [{ itemId: "task-1", stage: "step:3" }], restartError = "") =>
  available({
    install: makeUpdateInstall({ phase: "installed", version: "0.5.0", working, restartError }),
  });

describe("UpdateBlock", () => {
  it("offers Update to the newer version and starts the installation on the click", async () => {
    const { user } = block(available());

    expect(
      screen.getByRole("heading", { level: 3, name: "MySpec 0.5.0 is available" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/curl -fsSL/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update to 0.5.0" }));

    expect(api.installUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows Updating… on the same button and keeps the focus on it", async () => {
    api.installUpdate.mockImplementation(() => new Promise(() => {}));
    const { user } = block(available());
    await user.click(screen.getByRole("button", { name: "Update to 0.5.0" }));
    const button = await screen.findByRole("button", { name: "Updating…" });
    button.focus();

    act(() => {
      useAppStore.setState({
        app: makeState({
          update: available({
            install: makeUpdateInstall({ phase: "installing", target: "0.5.0" }),
          }),
        }),
      });
    });

    const updating = screen.getByRole("button", { name: "Updating…" });
    expect(updating).toBe(button);
    expect(updating).toHaveFocus();
    expect(screen.getByText("You can keep working meanwhile.")).toBeInTheDocument();
  });

  it("keeps the focus on Try again when the installation starts again", async () => {
    api.installUpdate.mockImplementation(() => new Promise(() => {}));
    const { user } = block(
      available({
        install: makeUpdateInstall({
          phase: "failed",
          target: "0.5.0",
          failure: makeUpdateInstallFailure({ kind: "offline" }),
        }),
      }),
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    const button = await screen.findByRole("button", { name: "Updating…" });
    button.focus();

    act(() => {
      useAppStore.setState({
        app: makeState({
          update: available({
            install: makeUpdateInstall({ phase: "installing", target: "0.5.0" }),
          }),
        }),
      });
    });

    const updating = screen.getByRole("button", { name: "Updating…" });
    expect(updating).toBe(button);
    expect(updating).toHaveFocus();
  });

  it("says the installation failed, with the commands and the install command", async () => {
    const { user } = block(
      available({
        install: makeUpdateInstall({
          phase: "failed",
          target: "0.5.0",
          failure: makeUpdateInstallFailure({
            kind: "libraries",
            reason: "Missing libwebkit2gtk.",
            commands: ["sudo apt install libwebkit2gtk-4.1-0"],
          }),
        }),
      }),
    );

    expect(screen.getByText("Couldn't update")).toBeInTheDocument();
    expect(screen.getByText("Missing libwebkit2gtk.")).toBeInTheDocument();
    expect(screen.getByText("Install them, then try again.")).toBeInTheDocument();
    expect(screen.getByText(/sudo apt install/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the command" })).toBeInTheDocument();
    expect(screen.getByText(/run the install command in a terminal/)).toBeInTheDocument();
    expect(screen.getByText(/curl -fsSL/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the install command" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(api.installUpdate).toHaveBeenCalledTimes(1);
  });

  it("lists the agents a restart stops", () => {
    block(
      installed([
        { itemId: "task-1", stage: "step:3" },
        { itemId: "gone", stage: "pr_review" },
      ]),
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "MySpec 0.5.0 is installed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Restart to use it. Until then, MySpec 0.4.0 keeps running."),
    ).toBeInTheDocument();
    expect(screen.getByText("Restarting now stops the agents that are working:")).toBeVisible();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["add-login · Step 3", "PR review"]);
  });

  it("says no agent is working", () => {
    block(installed([]));

    expect(screen.getByText("No agent is working. Restarting stops nothing.")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("drops Later and moves the focus to Restart now", async () => {
    const { user } = block(installed());

    await user.click(screen.getByRole("button", { name: "Later" }));

    expect(useAppStore.getState().updateLater).toBe(true);
    expect(screen.queryByRole("button", { name: "Later" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart now" })).toHaveFocus();
  });

  it("restarts on Restart now", async () => {
    const { user } = block(installed());

    await user.click(screen.getByRole("button", { name: "Restart now" }));

    await waitFor(() => expect(api.restartForUpdate).toHaveBeenCalledTimes(1));
  });

  it("says the restart failed", () => {
    block(installed([], "exec: no such file"));

    expect(screen.getByText("Couldn't restart")).toBeInTheDocument();
    expect(screen.getByText("exec: no such file")).toBeInTheDocument();
    expect(screen.getByText("Close MySpec and open it again.")).toBeInTheDocument();
  });
});
