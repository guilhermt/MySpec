import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Continue, type ContinueView } from "./Continue";

const MODEL: ContinueView = {
  row: {
    itemKind: "task",
    name: "Add the audit log",
    tone: "wait",
    line2: { long: "Question · Reviewer · Step 3/7" },
    clock: { kind: "chip", tone: "wait", time: "18m", longTime: "18 minutes" },
  },
  crumbs: "Platform Roadmap / API hardening",
  label: "Continue: Add the audit log. Platform Roadmap / API hardening",
};

function draw(model: ContinueView = MODEL) {
  const onOpen = vi.fn();
  const rendered = renderWithStore(<Continue model={model} onOpen={onOpen} />);
  return { ...rendered, onOpen };
}

describe("Continue", () => {
  it("is a button named by the label of the model", () => {
    draw();
    expect(
      screen.getByRole("button", {
        name: "Continue: Add the audit log. Platform Roadmap / API hardening",
      }),
    ).toBeInTheDocument();
  });

  it("writes the second line: what it is doing, the clock and where it lives", () => {
    draw();
    expect(screen.getByText("Question · Reviewer · Step 3/7")).toBeInTheDocument();
    expect(screen.getByText("waiting for you, 18 minutes", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("· Platform Roadmap / API hardening")).toBeInTheDocument();
  });

  it("writes the word of a state without a chip, and no place without crumbs", () => {
    draw({
      ...MODEL,
      crumbs: "",
      row: { ...MODEL.row, tone: "idle", clock: { kind: "word", word: "idle" } },
    });
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(screen.queryByText(/^·/)).not.toBeInTheDocument();
  });

  it("opens the item", async () => {
    const { user, onOpen } = draw();
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows Enter as a key the reader does not hear twice", () => {
    draw();
    expect(screen.getByText("Enter").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});
