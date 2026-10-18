import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckForUpdatesButton } from "@/features/about/CheckForUpdatesButton";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  api,
  makeState,
  makeUpdate,
  makeUpdateInstall,
  makeUpdateRelease,
} from "@/test/wails-mock";

function button(update = makeUpdate()) {
  return renderWithStore(<CheckForUpdatesButton />, { state: makeState({ update }) });
}

const announced = () => useAppStore.getState().announcement?.text;

describe("CheckForUpdatesButton", () => {
  it("checks for updates when it is clicked and announces the latest version", async () => {
    const { user } = button();

    await user.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(api.checkForUpdates).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(announced()).toBe("You're on the latest version."));
  });

  it("shows Checking… and does nothing while a check runs", async () => {
    const { user } = button(makeUpdate({ running: true }));

    const checking = screen.getByRole("button", { name: "Checking…" });
    await user.click(checking);

    expect(api.checkForUpdates).not.toHaveBeenCalled();
  });

  it("is unavailable while an update installs", async () => {
    const { user } = button(
      makeUpdate({ install: makeUpdateInstall({ phase: "installing", target: "0.5.0" }) }),
    );

    const check = screen.getByRole("button", { name: "Check for updates" });
    await user.click(check);

    expect(check).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("An update is running.")).toBeInTheDocument();
    expect(api.checkForUpdates).not.toHaveBeenCalled();
  });

  it("does not check again while its own check is waiting", async () => {
    api.checkForUpdates.mockImplementation(() => new Promise(() => {}));
    const { user } = button();

    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    await user.click(await screen.findByRole("button", { name: "Checking…" }));

    expect(api.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("announces the failure", async () => {
    api.checkForUpdates.mockResolvedValue(makeUpdate({ failure: { kind: "offline", detail: "" } }));
    const { user } = button();

    await user.click(screen.getByRole("button", { name: "Check for updates" }));

    await waitFor(() =>
      expect(announced()).toBe("Couldn't check for updates. No connection to GitHub."),
    );
  });

  it("announces a version that was already known, and leaves a new one to the state", async () => {
    const known = makeUpdate({ latest: "0.5.0", releases: [makeUpdateRelease()] });
    api.checkForUpdates.mockResolvedValue(known);
    const { user } = button(known);

    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    await waitFor(() => expect(announced()).toBe("MySpec 0.5.0 is available."));
  });

  it("announces nothing itself for a version the check found", async () => {
    api.checkForUpdates.mockResolvedValue(
      makeUpdate({ latest: "0.5.0", releases: [makeUpdateRelease()] }),
    );
    const { user } = button();

    await user.click(screen.getByRole("button", { name: "Check for updates" }));

    await waitFor(() => expect(api.checkForUpdates).toHaveBeenCalled());
    expect(announced()).toBeUndefined();
  });
});
