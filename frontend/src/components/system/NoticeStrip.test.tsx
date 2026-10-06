import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";
import { NoticeStrip } from "./NoticeStrip";

describe("NoticeStrip", () => {
  it("is an alert, when it says so, with its title and reason", () => {
    renderWithStore(
      <NoticeStrip role="alert" title="Couldn't read the PR" reason="gh is not signed in." />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't read the PR");
    expect(alert).toHaveTextContent("gh is not signed in.");
  });

  it("has no role unless it is given one", () => {
    renderWithStore(<NoticeStrip title="Couldn't read the PR" reason="gh is not signed in." />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is a status while it retries", () => {
    renderWithStore(
      <NoticeStrip
        title="Couldn't read the PR"
        role="status"
        action={
          <Button loading loadingLabel="Reading…">
            Retry
          </Button>
        }
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Reading…");
  });

  it("draws the blocked glyph hidden from assistive technology", () => {
    const { container } = renderWithStore(<NoticeStrip title="Couldn't read the PR" />);
    expect(container.querySelector('[data-state="blocked"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows the error in the error ink", () => {
    renderWithStore(<NoticeStrip title="Couldn't read the PR" error="HTTP 502" />);
    expect(screen.getByText("HTTP 502")).toHaveClass("text-state-error");
  });

  it("draws a border when outlined", () => {
    renderWithStore(<NoticeStrip role="alert" title="Couldn't read the PR" outlined />);
    expect(screen.getByRole("alert")).toHaveClass("border-line-2");
  });
});
