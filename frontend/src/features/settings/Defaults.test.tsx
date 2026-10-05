import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Defaults } from "@/features/settings/Defaults";
import { api, type ModelCatalog, type StageModel } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeModelCatalog, makeModelDefaults, makeState } from "@/test/wails-mock";

function defaults(
  options: { catalog?: ModelCatalog; models?: StageModel[]; reviewMode?: "agent" | "manual" } = {},
) {
  return renderWithStore(<Defaults />, {
    state: makeState({
      modelCatalog: options.catalog ?? makeModelCatalog(),
      modelDefaults: options.models ?? makeModelDefaults(),
      reviewModeDefault: options.reviewMode ?? "manual",
    }),
  });
}

const group = (name: string) => screen.getByRole("group", { name });
const reviewGroup = () => screen.getByRole("radiogroup", { name: "Review mode of a new task" });

describe("Defaults", () => {
  it("is the page Defaults, with its sentence and its two sections", () => {
    defaults();

    expect(screen.getByRole("heading", { level: 2, name: "Defaults" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "What a new task, review or discussion starts with. A change applies to what you create after it; nothing that runs changes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Review mode" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Models" })).toBeInTheDocument();
    expect(screen.getByText("Who reviews the steps of a new task")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add/ })).not.toBeInTheDocument();
  });

  it("lists the nine stages in the four groups, the last without a title", () => {
    defaults();

    const rows = (name: string) => within(group(name)).getAllByRole("listitem");
    expect(rows("Planning")).toHaveLength(4);
    expect(rows("Steps")).toHaveLength(2);
    expect(rows("Pull request")).toHaveLength(2);
    expect(rows("Discussion")).toHaveLength(1);
    expect(within(group("Planning")).getByText("Planning")).toBeInTheDocument();
    expect(within(group("Discussion")).queryByText("Discussion", { selector: "p" })).toBeNull();
    expect(
      within(group("Pull request")).getByText(
        "Also where a review of someone's pull request starts",
      ),
    ).toBeInTheDocument();
    expect(
      within(group("Discussion")).getByText("Where a new discussion starts"),
    ).toBeInTheDocument();
  });

  it("counts what changed from the factory defaults", () => {
    const { unmount } = defaults();

    expect(screen.getByText("None changed from the factory defaults")).toBeInTheDocument();

    unmount();
    defaults({
      models: makeModelDefaults().map((line) =>
        line.stage === "prd" ? { ...line, effort: "xhigh" } : line,
      ),
    });

    expect(screen.getByText("1 of 9 changed from the factory defaults")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "PRD: Fable 5.1 · xhigh, changed from the factory default Fable 5.1 · high",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "PR: Opus 5.5 (1M) · medium, the factory default",
      }),
    ).toBeInTheDocument();
  });

  it("says the models are being read, with no notice", () => {
    defaults({ catalog: makeModelCatalog({ models: [], failure: "" }) });

    expect(screen.getByText("Reading the models of Claude Code…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it.each([
    ["not_found", "Claude Code was not found", /point MYSPEC_CLAUDE_PATH at the executable/],
    [
      "unsupported",
      "The installed Claude Code doesn't list its models",
      /Update it, then reopen MySpec/,
    ],
    ["failed", "Couldn't read the models of Claude Code", /Reopen MySpec to try again/],
  ] as const)(
    "says why there are no models for %s, in a notice that is never an alert",
    (failure, title, text) => {
      defaults({ catalog: makeModelCatalog({ models: [], failure }) });

      const notice = screen.getByRole("status");
      expect(notice).toHaveTextContent(title);
      expect(notice).toHaveTextContent(text);
      expect(notice).toHaveTextContent("The choices below stay as they are.");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("Reading the models of Claude Code…")).not.toBeInTheDocument();
    },
  );

  it("says nothing of the catalog when there is one", () => {
    defaults();

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ends the section with what a commit runs in", () => {
    defaults();

    expect(
      screen.getByText(
        "A commit runs in the session of its step or of its pull request review, with that session's model and effort.",
      ),
    ).toBeInTheDocument();
  });

  describe("review mode", () => {
    it("checks the default and saves another at once", async () => {
      const { user } = defaults();

      expect(screen.getByRole("radio", { name: /^Manual/ })).toHaveAttribute(
        "aria-checked",
        "true",
      );

      await user.click(screen.getByRole("radio", { name: /^Agent/ }));

      expect(api.setReviewModeDefault).toHaveBeenCalledWith("agent");
    });

    it("shows the new option chosen and saving until the answer comes", async () => {
      let finish = () => {};
      vi.mocked(api.setReviewModeDefault).mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      const { user } = defaults();

      await user.click(screen.getByRole("radio", { name: /^Agent/ }));

      expect(screen.getByRole("radio", { name: /^Agent/ })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: /^Agent/ })).toHaveTextContent("Agent · saving…");
      expect(reviewGroup()).toHaveAttribute("aria-busy", "true");

      finish();
      await waitFor(() => expect(reviewGroup()).not.toHaveAttribute("aria-busy"));
    });

    it("goes back to the saved mode and says why it failed, with Try again that saves the same choice again", async () => {
      vi.mocked(api.setReviewModeDefault).mockRejectedValueOnce(new Error("the disk is full"));
      const { user } = defaults();

      await user.click(screen.getByRole("radio", { name: /^Agent/ }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't save Agent: the disk is full");
      expect(screen.getByRole("radio", { name: /^Manual/ })).toHaveAttribute(
        "aria-checked",
        "true",
      );

      await user.click(within(alert).getByRole("button", { name: "Try again" }));

      expect(api.setReviewModeDefault).toHaveBeenLastCalledWith("agent");
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });
  });

  it("saves a model of a stage at once", async () => {
    const { user } = defaults();

    await user.click(
      screen.getByRole("button", { name: "PR: Opus 5.5 (1M) · medium, the factory default" }),
    );
    await user.click(await screen.findByRole("menuitemradio", { name: "low" }));

    expect(api.setModelDefault).toHaveBeenCalledWith("pr", "claude-opus-5-5[1m]", "low");
  });
});
