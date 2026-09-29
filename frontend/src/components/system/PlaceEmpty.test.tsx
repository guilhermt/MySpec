import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { PlaceEmpty } from "./PlaceEmpty";

describe("PlaceEmpty", () => {
  it("says the title and the body, the title a paragraph, with no live region", () => {
    const { container } = renderWithStore(
      <PlaceEmpty title="Every step is committed">
        <p>7 steps in acme/api. The pull request stage starts next.</p>
      </PlaceEmpty>,
    );
    expect(container).toHaveTextContent(
      "Every step is committed7 steps in acme/api. The pull request stage starts next.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Every step is committed").tagName).toBe("P");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("says only the title without a body", () => {
    const { container } = renderWithStore(<PlaceEmpty title="No steps were found" />);
    expect(container).toHaveTextContent(/^No steps were found$/);
  });
});
