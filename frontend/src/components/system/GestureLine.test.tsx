import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GestureLineView } from "@/components/system/draft-views";
import { renderWithStore } from "@/test/render";
import { GestureLine } from "./GestureLine";

const CHAIN: GestureLineView = {
  icon: "chain",
  segments: [
    { text: "Approve", strong: true },
    { text: " publishes the epic and this card to GitHub now. ", strong: false },
    { text: "Discard", strong: true },
    { text: " publishes the epic now.", strong: false },
  ],
  text: "Approve publishes the epic and this card to GitHub now. Discard publishes the epic now.",
};

describe("GestureLine", () => {
  it("describes Approve with the whole line", () => {
    renderWithStore(
      <>
        <button type="button" aria-describedby="gesture">
          Approve
        </button>
        <GestureLine id="gesture" view={CHAIN} />
      </>,
    );

    expect(screen.getByRole("button", { name: "Approve" })).toHaveAccessibleDescription(CHAIN.text);
  });

  it("writes Approve and Discard strong", () => {
    renderWithStore(<GestureLine id="gesture" view={CHAIN} />);

    expect(screen.getByText("Approve").tagName).toBe("STRONG");
    expect(screen.getByText("Discard").tagName).toBe("STRONG");
    expect(screen.getByText(/publishes the epic now/).tagName).toBe("SPAN");
  });

  it("draws the chain, the hourglass or the blocked glyph", () => {
    const { container, rerender } = renderWithStore(<GestureLine id="gesture" view={CHAIN} />);
    expect(container.querySelector("svg.lucide-link")).toBeInTheDocument();

    rerender(<GestureLine id="gesture" view={{ ...CHAIN, icon: "hourglass" }} />);
    expect(container.querySelector("svg.lucide-hourglass")).toBeInTheDocument();

    rerender(<GestureLine id="gesture" view={{ ...CHAIN, icon: "blocked" }} />);
    expect(container.querySelector('[data-state="blocked"]')).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});
