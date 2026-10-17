import { cleanup, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AboutPage } from "@/features/about/AboutPage";
import { renderWithStore } from "@/test/render";
import { fixSettingsSceneClock, settingsScene } from "@/test/settings-scenes";
import { makeState, makeUpdate } from "@/test/wails-mock";

fixSettingsSceneClock();

function page(variation = "") {
  return renderWithStore(<AboutPage />, {
    state: settingsScene("settings-about", variation).state,
  });
}

describe("AboutPage", () => {
  it("says the version that is installed", () => {
    page();

    expect(screen.getByRole("heading", { level: 2, name: "About" })).toBeInTheDocument();
    expect(screen.getByText("MySpec 0.4.0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeInTheDocument();
  });

  it("says a local build never checks and offers no check", () => {
    page("local");

    expect(screen.getByText("MySpec dev")).toBeInTheDocument();
    expect(screen.getByText("Local builds don't check for updates.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check for updates" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Checked/)).not.toBeInTheDocument();
  });

  it("says the latest version is installed and when it was checked", () => {
    page();

    expect(screen.getByText("You're on the latest version.")).toBeInTheDocument();
    expect(screen.getByText("Checked 1m ago")).toBeInTheDocument();
    expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
  });

  it("shows Checking… while a check runs", () => {
    page("checking");

    expect(screen.getByRole("button", { name: "Checking…" })).toBeInTheDocument();
  });

  it("says why the check failed, without an alert", () => {
    page("failed");

    expect(screen.getByText("Couldn't check for updates")).toBeInTheDocument();
    expect(screen.getByText("No connection to GitHub.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the newer version with its block and the notes, newest first", () => {
    page("available");

    expect(
      screen.getByRole("heading", { level: 3, name: "MySpec 0.5.0 is available" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update to 0.5.0" })).toBeInTheDocument();
    expect(screen.queryByText(/curl -fsSL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/run the install command/)).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent),
    ).toEqual(["0.5.0 · Oct 16", "0.4.2 · Oct 15", "0.4.1 · Oct 14"]);
    expect(screen.queryByText("You're on the latest version.")).not.toBeInTheDocument();
  });

  it("says a release without notes has none", () => {
    page("available");

    const release = screen.getByRole("article", { name: "0.4.2 · Oct 15" });
    expect(within(release).getByText("No notes for this release.")).toBeInTheDocument();
  });

  // The links of the notes open in the system browser through the Markdown (Markdown.test.tsx).
  it("renders the notes of a release as Markdown", () => {
    page("available");

    const notes = screen.getAllByTestId("markdown");
    expect(notes).toHaveLength(2);
    expect(notes[0]).toHaveTextContent("## What's Changed");
    expect(notes[0]).toHaveClass("ui-headings");
  });

  it("shows the block of the installation in each phase", () => {
    page("updating");
    expect(screen.getByRole("button", { name: "Updating…" })).toBeInTheDocument();
    cleanup();

    page("installed");
    expect(
      screen.getByRole("heading", { level: 3, name: "MySpec 0.5.0 is installed" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Restart now" })).toBeInTheDocument();
    cleanup();

    page("install-failed");
    expect(screen.getByText("Couldn't update")).toBeInTheDocument();
    expect(screen.getByText(/curl -fsSL/)).toBeInTheDocument();
  });

  it("makes Check for updates unavailable while the update installs", () => {
    page("updating");

    expect(screen.getByRole("button", { name: "Check for updates" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("An update is running.")).toBeInTheDocument();
  });

  it("shows no notes block without releases", () => {
    renderWithStore(<AboutPage />, {
      state: makeState({
        update: makeUpdate({ latest: "0.5.0", releases: [] }),
      }),
    });

    expect(
      screen.getByRole("heading", { level: 3, name: "MySpec 0.5.0 is available" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Release notes")).not.toBeInTheDocument();
  });
});
