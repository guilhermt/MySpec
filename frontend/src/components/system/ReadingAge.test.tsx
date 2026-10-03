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

  it("says Not read yet for a list never read, when asked", () => {
    renderWithStore(<ReadingAge readAt="" reading={false} now={NOW} never />);
    expect(screen.getByText("Not read yet")).toBeInTheDocument();
  });

  it("says nothing of a list read, whatever never says", () => {
    renderWithStore(<ReadingAge readAt="2026-09-24T14:08:00Z" reading={false} now={NOW} never />);
    expect(screen.queryByText("Not read yet")).not.toBeInTheDocument();
  });

  it("says the reading failed and how long ago", () => {
    renderWithStore(
      <ReadingAge
        readAt="2026-09-24T13:00:00Z"
        reading={false}
        now={NOW}
        failure={{ failedAt: "2026-09-24T13:52:00Z" }}
      />,
    );
    expect(screen.getByText("Read failed 18m ago")).toBeInTheDocument();
  });

  it("says the reading failed even when the list was never read", () => {
    renderWithStore(
      <ReadingAge
        readAt=""
        reading={false}
        now={NOW}
        never
        failure={{ failedAt: "2026-09-24T13:52:00Z" }}
      />,
    );
    expect(screen.getByText("Read failed 18m ago")).toBeInTheDocument();
    expect(screen.queryByText("Not read yet")).not.toBeInTheDocument();
  });

  it("is a status while a reading runs, over a failure", () => {
    renderWithStore(
      <ReadingAge readAt="" reading now={NOW} failure={{ failedAt: "2026-09-24T13:52:00Z" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Reading…");
    expect(screen.queryByText(/Read failed/)).not.toBeInTheDocument();
  });

  it("gives the failure time and the last read in the tooltip", async () => {
    const { user } = renderWithStore(
      <ReadingAge
        readAt="2026-09-24T13:00:00Z"
        reading={false}
        now={NOW}
        failure={{ failedAt: "2026-09-24T13:52:00Z" }}
      />,
    );
    await user.hover(screen.getByText("Read failed 18m ago"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /^Failed at \d\d:\d\d · last read at \d\d:\d\d$/,
    );
  });

  it("gives only the failure time in the tooltip of a list never read", async () => {
    const { user } = renderWithStore(
      <ReadingAge
        readAt=""
        reading={false}
        now={NOW}
        failure={{ failedAt: "2026-09-24T13:52:00Z" }}
      />,
    );
    await user.hover(screen.getByText("Read failed 18m ago"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Failed at \d\d:\d\d$/);
  });
});
