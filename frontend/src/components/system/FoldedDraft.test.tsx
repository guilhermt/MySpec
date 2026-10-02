import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { FoldedDraft, type FoldedDraftProps } from "./FoldedDraft";

const NAME =
  "Draft 3 of 5: New card. Overage on the monthly invoice. acme/billing, Billing. Approved, waits for the epic.";

function draw(overrides: Partial<FoldedDraftProps> = {}) {
  const onOpen = vi.fn();
  renderWithStore(
    <FoldedDraft
      id="d3"
      number={3}
      kind="New card"
      revised={false}
      title="Overage on the monthly invoice"
      muted={false}
      line2="acme/billing · Billing · Depends on Tier limits"
      state={{ text: "Approved · waits for the epic", glyph: "hold", strong: false, error: false }}
      name={NAME}
      tabStop
      requestTarget={false}
      onOpen={onOpen}
      {...overrides}
    />,
  );
  return { onOpen, group: screen.getByRole("group", { name: NAME }) };
}

describe("FoldedDraft", () => {
  it("is a folded group named for the reader, keyed for the card", () => {
    const { group } = draw();

    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(group).toHaveAttribute("data-card-item", "d3");
    expect(group).toHaveAttribute("tabindex", "0");
    expect(group).not.toHaveAttribute("data-request-target");
  });

  it("draws the kind, the title, the state and the second line", () => {
    draw();

    expect(screen.getByText("New card")).toBeInTheDocument();
    expect(screen.getByText("Overage on the monthly invoice")).toBeInTheDocument();
    expect(screen.getByText("Approved · waits for the epic")).toBeInTheDocument();
    expect(screen.getByText("acme/billing · Billing · Depends on Tier limits")).toBeInTheDocument();
    expect(screen.queryByText("Revised")).not.toBeInTheDocument();
  });

  it("says Revised when the agent revised it", () => {
    draw({ revised: true });

    expect(screen.getByText("Revised")).toBeInTheDocument();
  });

  it("leaves the tab stop to another draft", () => {
    const { group } = draw({ tabStop: false });

    expect(group).toHaveAttribute("tabindex", "-1");
  });

  it("marks itself as what the request bar names", () => {
    const { group } = draw({ requestTarget: true });

    expect(group).toHaveAttribute("data-request-target", "");
  });

  it("opens with a click and with Enter", async () => {
    const user = userEvent.setup();
    const { onOpen, group } = draw();

    await user.click(group);
    group.focus();
    await user.keyboard("{Enter}");

    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("leaves A, D and E to the card around it", async () => {
    const user = userEvent.setup();
    const { onOpen, group } = draw();
    group.focus();

    await user.keyboard("ade ");

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("says Publishing… as a live status", () => {
    draw({ state: { text: "Publishing…", glyph: "spinner", strong: false, error: false } });

    expect(screen.getByRole("status")).toHaveTextContent("Publishing…");
  });

  it("draws the rail of a failure", () => {
    const { group } = draw({
      state: {
        text: "Couldn't write to GitHub · open it to Retry",
        glyph: "error",
        strong: false,
        error: true,
      },
    });

    expect(group).toHaveClass("error-rail-bar");
    expect(group.querySelector('[data-state="error"]')).toBeInTheDocument();
  });

  it("draws the outlined diamond of a blocked draft", () => {
    const { group } = draw({
      state: {
        text: "Can't publish · choose a repository",
        glyph: "blocked",
        strong: false,
        error: false,
      },
    });

    expect(group.querySelector('[data-state="blocked"]')).toBeInTheDocument();
    expect(group).not.toHaveClass("error-rail-bar");
  });

  it("draws no second line when it has nothing to say", () => {
    draw({ line2: "" });

    expect(screen.queryByText(/acme\/billing/)).not.toBeInTheDocument();
  });
});
