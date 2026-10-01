import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArrivalFocus } from "@/components/ArrivalFocus";
import type { RequestFocus } from "@/lib/focus";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";

// Place is what a screen puts around the arrival: the title, the bar with its primary, the composer.
function Place({ target, ready }: { target: RequestFocus | null; ready: boolean }) {
  return (
    <>
      <h1 tabIndex={-1}>add-login</h1>
      <section aria-label="Request" tabIndex={-1}>
        <button type="button" data-variant="primary">
          Approve
        </button>
      </section>
      <textarea id="composer-input" aria-label="Message" />
      <ArrivalFocus target={target} ready={ready} />
    </>
  );
}

function arrive(target: RequestFocus | null, ready = true) {
  return renderWithStore(<Place target={target} ready={ready} />, {
    ui: { pendingFocus: "request" },
  });
}

describe("ArrivalFocus", () => {
  it("takes the focus to what the situation asks, and is done with the arrival", () => {
    arrive("primary");

    expect(screen.getByRole("button", { name: "Approve" })).toHaveFocus();
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("goes to the composer without a situation", () => {
    arrive(null);

    expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus();
  });

  it("falls back to the title when what the situation asks isn't on screen", () => {
    arrive("question");

    expect(screen.getByRole("heading", { name: "add-login" })).toHaveFocus();
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("waits for the conversation and the bar to be on screen", () => {
    const { rerender } = arrive("primary", false);

    expect(screen.getByRole("button", { name: "Approve" })).not.toHaveFocus();
    expect(useAppStore.getState().pendingFocus).toBe("request");

    rerender(<Place target="primary" ready />);

    expect(screen.getByRole("button", { name: "Approve" })).toHaveFocus();
  });

  it("leaves the focus alone when the place wasn't reached by a situation", () => {
    renderWithStore(<Place target="primary" ready />, { ui: { pendingFocus: "title" } });

    expect(screen.getByRole("button", { name: "Approve" })).not.toHaveFocus();
    expect(useAppStore.getState().pendingFocus).toBe("title");
  });
});
