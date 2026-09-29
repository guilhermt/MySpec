import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { PlaceEmpty } from "./PlaceEmpty";

describe("PlaceEmpty", () => {
  it("says the title and the body as a status, the title a paragraph", () => {
    renderWithStore(
      <PlaceEmpty title="Every step is committed">
        <p>7 steps in acme/api. The pull request stage starts next.</p>
      </PlaceEmpty>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Every step is committed7 steps in acme/api. The pull request stage starts next.",
    );
    expect(screen.getByText("Every step is committed").tagName).toBe("P");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("says only the title without a body", () => {
    renderWithStore(<PlaceEmpty title="No steps were found" />);
    expect(screen.getByRole("status")).toHaveTextContent(/^No steps were found$/);
  });
});
