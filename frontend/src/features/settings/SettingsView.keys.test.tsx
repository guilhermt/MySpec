import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/app/AppShell";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { SettingsView } from "@/features/settings/SettingsView";
import { StartScreen } from "@/features/startup/StartScreen";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  fixSettingsSceneClock,
  type SettingsSceneName,
  type SettingsSceneSetup,
  settingsScene,
  startScene,
  welcomeScene,
} from "@/test/settings-scenes";
import { api } from "@/test/wails-mock";

// The keyboard of the app, which closes Settings with Esc and opens and closes it with Ctrl+,.
function Shortcuts() {
  useGlobalShortcuts();
  return null;
}

fixSettingsSceneClock();

// setup answers the boundary the way the scene says and draws the screen the keys are pressed on.
function setup(scene: SettingsSceneSetup, element = <SettingsView />) {
  const { state, location, storage, listings, prompt } = scene;
  for (const [key, value] of Object.entries(storage)) {
    localStorage.setItem(key, value);
  }
  if (listings instanceof Error) {
    api.listPrompts.mockRejectedValue(listings);
  } else if (listings !== undefined) {
    api.listPrompts.mockResolvedValue(listings);
  }
  if (prompt instanceof Error) {
    api.getPrompt.mockRejectedValue(prompt);
  } else if (prompt !== undefined) {
    api.getPrompt.mockResolvedValue(prompt);
  }
  return renderWithStore(
    <>
      <Shortcuts />
      {element}
    </>,
    { state, startup: scene.startup ?? null, ui: { location } },
  );
}

// drawn draws a page of Settings and does what its scene has the user do.
async function drawn(name: SettingsSceneName, variation: string) {
  const scene = settingsScene(name, variation);
  const view = setup(scene);
  await scene.after?.(view.user);
  return view;
}

const link = (name: string) => screen.getByRole("link", { name });
const place = () => useAppStore.getState().location;
const ctrl = (key: string) => `{Control>}${key}{/Control}`;

describe("the keyboard of Settings", () => {
  describe("Ctrl+,", () => {
    it("opens Settings from the welcome and closes it back to the welcome", async () => {
      const scene = welcomeScene("");
      const { user } = setup(scene, <AppShell />);
      await screen.findByRole("heading", { level: 1, name: "Welcome to MySpec" });

      await user.keyboard(ctrl(","));

      expect(place()).toEqual({ kind: "settings", section: "defaults" });
      await waitFor(() => expect(link("Defaults")).toHaveFocus());

      await user.keyboard(ctrl(","));

      expect(place()).toEqual({ kind: "home" });
      await waitFor(() =>
        expect(screen.getByRole("heading", { level: 1, name: "Welcome to MySpec" })).toHaveFocus(),
      );
    });

    it("opens Settings from anywhere with the focus on the page in the navigation", async () => {
      const { user } = setup({
        ...settingsScene("settings-defaults", ""),
        location: { kind: "home" },
      });

      await user.keyboard(ctrl(","));

      expect(place()).toEqual({ kind: "settings", section: "defaults" });
    });
  });

  describe("Esc", () => {
    it("closes Settings to the place it was opened from, the welcome when it came from there", async () => {
      const { user } = setup(welcomeScene(""), <AppShell />);
      await screen.findByRole("heading", { level: 1, name: "Welcome to MySpec" });
      await user.keyboard(ctrl(","));
      await screen.findByRole("navigation", { name: "Settings" });

      await user.keyboard("{Escape}");

      expect(place()).toEqual({ kind: "home" });
    });

    it("closes the dialog that is open and leaves Settings open", async () => {
      const { user } = await drawn("settings-boards", "add-1");

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(place().kind).toBe("settings");
      await waitFor(() => expect(screen.getByRole("button", { name: "Add board" })).toHaveFocus());
    });

    it("closes the menu that is open and leaves Settings open", async () => {
      const { user } = await drawn("settings-repos", "menu");

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(place().kind).toBe("settings");
      expect(screen.getByRole("button", { name: "More for acme/web" })).toHaveFocus();
    });

    it("cancels the block of the review instructions and leaves Settings open", async () => {
      const { user } = await drawn("settings-repos", "instructions");
      expect(screen.getByRole("textbox", { name: "Review instructions" })).toHaveFocus();

      await user.keyboard("{Escape}");

      expect(
        screen.queryByRole("textbox", { name: "Review instructions" }),
      ).not.toBeInTheDocument();
      expect(place().kind).toBe("settings");
    });

    it("cancels the edit of a prompt, asking first when something changed", async () => {
      const { user } = await drawn("settings-prompts", "edit");

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("textbox", { name: "PRD prompt" })).not.toBeInTheDocument();
      expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("asks to discard the changes of the edit of a prompt", async () => {
      const { user } = await drawn("settings-prompts", "edit");
      await user.type(screen.getByRole("textbox", { name: "PRD prompt" }), "More. ");

      await user.keyboard("{Escape}");

      const dialog = await screen.findByRole("alertdialog", { name: "Discard your changes?" });
      await waitFor(() =>
        expect(within(dialog).getByRole("button", { name: "Keep editing" })).toHaveFocus(),
      );
      expect(screen.getByRole("textbox", { name: "PRD prompt", hidden: true })).toBeInTheDocument();
    });
  });

  describe("↑ ↓ Home End ← →, on the navigation", () => {
    it("trades the page with ↑ and ↓ and goes to the ends with Home and End", async () => {
      const { user } = await drawn("settings-defaults", "");
      link("Defaults").focus();

      await user.keyboard("{ArrowDown}");
      expect(place()).toEqual({ kind: "settings", section: "boards" });
      expect(link("Boards")).toHaveFocus();

      await user.keyboard("{End}");
      expect(place()).toEqual({ kind: "settings", section: "machine" });

      await user.keyboard("{ArrowDown}");
      expect(place()).toEqual({ kind: "settings", section: "machine" });

      await user.keyboard("{Home}{ArrowUp}");
      expect(place()).toEqual({ kind: "settings", section: "defaults" });
    });

    it("takes ← and → too while the navigation is a row, and not while it is a column", async () => {
      const { user } = await drawn("settings-defaults", "");
      const list = within(screen.getByRole("navigation", { name: "Settings" })).getByRole("list");
      link("Defaults").focus();

      list.style.flexDirection = "column";
      await user.keyboard("{ArrowRight}");
      expect(place()).toEqual({ kind: "settings", section: "defaults" });

      list.style.flexDirection = "row";
      await user.keyboard("{ArrowRight}");
      expect(place()).toEqual({ kind: "settings", section: "boards" });
      await user.keyboard("{ArrowLeft}");
      expect(place()).toEqual({ kind: "settings", section: "defaults" });
    });
  });

  describe("Enter", () => {
    it("reads the board from the field of the URL", async () => {
      const { user } = await drawn("settings-boards", "add-1");

      await user.type(
        screen.getByRole("textbox", { name: "URL of the GitHub project" }),
        "https://github.com/orgs/acme/projects/15{Enter}",
      );

      expect(api.previewBoard).toHaveBeenCalledWith("https://github.com/orgs/acme/projects/15");
    });

    it("adds the repository typed as owner/name in the dialog of a board", async () => {
      const { user } = await drawn("settings-boards", "edit-1");
      await user.click(await screen.findByRole("button", { name: /^Continue/ }));
      // The dialog takes the focus to the first field of the step once it shows.
      await waitFor(() =>
        expect(within(screen.getByRole("dialog")).getAllByRole("checkbox")[0]).toHaveFocus(),
      );

      await user.type(
        await screen.findByRole("textbox", { name: "Add a repository" }),
        "acme/marketing{Enter}",
      );

      expect(api.checkBoardRepository).toHaveBeenCalledWith(expect.any(String), "acme/marketing");
    });
  });

  describe("Ctrl+Enter", () => {
    it("takes the primary of the dialog of a board, step by step", async () => {
      const { user } = await drawn("settings-boards", "add-2");
      expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();

      await user.keyboard(ctrl("{Enter}"));

      expect(await screen.findByText(/Step 3 of 3/)).toBeInTheDocument();
    });

    it("adds from the dialog of Add repository", async () => {
      const { user } = await drawn("settings-repos", "add");
      await user.click(screen.getByRole("checkbox", { name: /^acme\/billing/ }));

      await user.keyboard(ctrl("{Enter}"));

      expect(api.addRepository).toHaveBeenCalledWith("/home/guilherme/src/billing");
    });

    it.each([
      ["settings-boards", "remove", "Remove Platform Roadmap?"],
      ["settings-repos", "remove", "Remove acme/docs?"],
      ["settings-prompts", "reset", "Reset the PRD prompt to the default?"],
      ["settings-prompts", "discard", "Discard your changes?"],
    ] as const)("does not confirm the destructive dialog %s %s", async (name, variation, title) => {
      const { user } = await drawn(name, variation);
      await screen.findByRole("alertdialog", { name: title });

      await user.keyboard(ctrl("{Enter}"));

      expect(screen.getByRole("alertdialog", { name: title })).toBeInTheDocument();
      for (const fn of [api.removeBoard, api.removeRepository, api.restorePrompt]) {
        expect(fn).not.toHaveBeenCalled();
      }
    });
  });

  describe("Ctrl+S", () => {
    it("saves the edit of a prompt", async () => {
      const { user } = await drawn("settings-prompts", "edit");
      await user.type(screen.getByRole("textbox", { name: "PRD prompt" }), "More. ");

      await user.keyboard(ctrl("s"));

      expect(api.savePrompt).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("button", { name: "Edit" })).toHaveFocus();
    });
  });

  describe("Enter on the start that failed", () => {
    it("tries again from the button and from the body, and leaves Copy to Copy", async () => {
      const { user } = setup(startScene("failed"), <StartScreen />);
      expect(screen.getByRole("button", { name: /^Try again/ })).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(api.tryStartupAgain).toHaveBeenCalledTimes(1);

      screen.getByRole("main").focus();
      await user.keyboard("{Enter}");
      expect(api.tryStartupAgain).toHaveBeenCalledTimes(2);

      screen.getByRole("button", { name: "Copy the error" }).focus();
      await user.keyboard("{Enter}");
      expect(api.tryStartupAgain).toHaveBeenCalledTimes(2);
    });
  });
});

describe("the focus of Settings", () => {
  it("starts on the page in the navigation when Settings opens by the keyboard", async () => {
    const { user } = setup(
      { ...settingsScene("settings-defaults", ""), location: { kind: "home" } },
      <AppShell />,
    );
    await user.keyboard(ctrl(","));

    await waitFor(() => expect(link("Defaults")).toHaveFocus());
  });

  it("starts the dialog of Add board on the field of the URL, and again after Back and Continue", async () => {
    const { user } = await drawn("settings-boards", "add-2");
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "URL of the GitHub project" })).toHaveFocus(),
    );

    await user.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getAllByRole("checkbox", { name: /ends the work/ })[0],
      ).toHaveFocus(),
    );
  });

  it("starts the dialog of Edit board on Cancel while it reads, and on the first field after", async () => {
    const reading = await drawn("settings-boards", "edit-reading");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    reading.unmount();

    await drawn("settings-boards", "edit-1");
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getAllByRole("checkbox", { name: /ends the work/ })[0],
      ).toHaveFocus(),
    );
  });

  it("starts the dialog of Add repository on the filter", async () => {
    await drawn("settings-repos", "add");

    await waitFor(() =>
      expect(screen.getByRole("searchbox", { name: "Filter by name or path" })).toHaveFocus(),
    );
  });

  it.each([
    ["settings-boards", "remove", "Remove Platform Roadmap?"],
    ["settings-repos", "remove", "Remove acme/docs?"],
    ["settings-prompts", "reset", "Reset the PRD prompt to the default?"],
  ] as const)("starts the dialog %s %s on Cancel", async (name, variation, title) => {
    await drawn(name, variation);

    const dialog = await screen.findByRole("alertdialog", { name: title });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
  });

  it("starts Discard your changes? on Keep editing", async () => {
    await drawn("settings-prompts", "discard");

    const dialog = await screen.findByRole("alertdialog", { name: "Discard your changes?" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Keep editing" })).toHaveFocus(),
    );
  });

  it("starts the edit of a prompt at the beginning of the text", async () => {
    await drawn("settings-prompts", "edit");

    const field = screen.getByRole("textbox", { name: "PRD prompt" });
    expect(field).toHaveFocus();
    expect(field).toHaveProperty("selectionStart", 0);
  });

  it("gives the focus back to the button that opened the dialog", async () => {
    const { user } = await drawn("settings-boards", "remove");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove Platform Roadmap" })).toHaveFocus(),
    );
  });

  it("takes the focus to the title of the page when the board is removed", async () => {
    const { user } = await drawn("settings-boards", "remove");

    await user.click(screen.getByRole("button", { name: "Remove board" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "Boards" })).toHaveFocus(),
    );
  });

  it("takes the focus to the title of the page when the repository is removed", async () => {
    const { user } = await drawn("settings-repos", "remove");

    await user.click(screen.getByRole("button", { name: "Remove repository" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "Repositories" })).toHaveFocus(),
    );
  });
});

describe("the focus of the welcome and the start", () => {
  it("starts the welcome on Add board", async () => {
    setup(welcomeScene(""), <AppShell />);

    await waitFor(() => expect(screen.getByRole("button", { name: /^Add board/ })).toHaveFocus());
  });

  it("takes the focus to the title of the Home when the first board is registered", async () => {
    setup(welcomeScene(""), <AppShell />);
    await screen.findByRole("heading", { level: 1, name: "Welcome to MySpec" });

    act(() => {
      useAppStore.getState().applyState(settingsScene("settings-defaults", "").state);
    });

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
    expect(screen.queryByRole("heading", { name: "Welcome to MySpec" })).not.toBeInTheDocument();
  });

  it("starts the start that failed on Try again", () => {
    setup(startScene("disk-full"), <StartScreen />);

    expect(screen.getByRole("button", { name: /^Try again/ })).toHaveFocus();
  });
});
