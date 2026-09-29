import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { ReadingAge } from "./ReadingAge";

const NOW = Date.parse("2026-09-24T14:10:00Z");

describe("ReadingAge", () => {
  it("says how long ago the list was read", () => {
    renderWithStore(<ReadingAge readAt="2026-09-24T14:08:00Z" reading={false} now={NOW} />);
    expect(screen.getByText("Read 2m ago")).toBeInTheDocument();
  });

  it("says just now under a minute", () => {
    renderWithStore(<ReadingAge readAt="2026-09-24T14:09:40Z" reading={false} now={NOW} />);
    expect(screen.getByText("Read just now")).toBeInTheDocument();
  });

  it("is a status while a reading runs, over the stored one", () => {
    renderWithStore(<ReadingAge readAt="2026-09-24T14:08:00Z" reading now={NOW} />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading…");
    expect(screen.queryByText(/^Read /)).not.toBeInTheDocument();
  });

  it("says nothing for a list never read", () => {
    const { container } = renderWithStore(<ReadingAge readAt="" reading={false} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });
});
