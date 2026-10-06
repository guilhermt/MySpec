import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { focusDraft } from "@/lib/focus";
import { revealItem } from "@/lib/reveal";

vi.mock("@/lib/reveal", () => ({ revealItem: vi.fn() }));

beforeEach(() => {
  vi.mocked(revealItem).mockClear();
});

function Card() {
  return (
    <div data-decision-card="">
      {/* biome-ignore lint/a11y/useSemanticElements: the open draft of the card is a group the system draws */}
      <div
        role="group"
        aria-label="Draft"
        tabIndex={-1}
        data-card-item="draft-1"
        data-request-target=""
      >
        <button type="button" data-request-control="">
          Approve
        </button>
      </div>
    </div>
  );
}

describe("focusDraft towards the control of the request", () => {
  it("brings the control into view on the arrival the request bar makes", () => {
    const { getByRole } = render(<Card />);

    focusDraft("draft-1", false, true);

    expect(revealItem).toHaveBeenCalledWith(
      getByRole("group", { name: "Draft" }),
      getByRole("button", { name: "Approve" }),
    );
  });

  it("reveals the draft alone when the focus goes there for another reason", () => {
    const { getByRole } = render(<Card />);

    focusDraft("draft-1", false);

    expect(revealItem).toHaveBeenCalledWith(getByRole("group", { name: "Draft" }), undefined);
  });
});
