import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UpdateButton } from "@/features/about/UpdateButton";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeState, makeUpdate, makeUpdateInstall } from "@/test/wails-mock";

function sign(update = makeUpdate()) {
  return renderWithStore(<UpdateButton />, { state: makeState({ update }) });
}

describe("UpdateButton", () => {
  it("is nothing without a newer version", () => {
    sign();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens About with the focus on its item when a newer version is known", async () => {
    const { user } = sign(makeUpdate({ latest: "0.5.0" }));

    await user.click(
      screen.getByRole("button", { name: "MySpec 0.5.0 is available. Open About." }),
    );

    const { location, pendingFocus } = useAppStore.getState();
    expect(location).toEqual({ kind: "settings", section: "about" });
    expect(pendingFocus).toBe("nav");
  });

  it("is busy while the update installs and still opens About", async () => {
    const { user } = sign(
      makeUpdate({
        latest: "0.5.0",
        install: makeUpdateInstall({ phase: "installing", target: "0.5.0" }),
      }),
    );

    const button = screen.getByRole("button", {
      name: "Updating to MySpec 0.5.0… Open About.",
    });
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "about" });
  });

  it("asks for the restart once the version is installed", () => {
    sign(makeUpdate({ install: makeUpdateInstall({ phase: "installed", version: "0.5.0" }) }));

    const button = screen.getByRole("button", {
      name: "MySpec 0.5.0 is installed. Restart to use it. Open About.",
    });
    expect(button).not.toHaveAttribute("aria-busy");
  });
});
