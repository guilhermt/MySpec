import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { type CheckRowView, ChecksList } from "./ChecksList";

const ROWS: readonly CheckRowView[] = [
  { name: "build", word: "passed", glyph: "done", tooltip: null, duration: "1m 52s", url: "" },
  { name: "docs", word: "skipped", glyph: "doneFaint", tooltip: null, duration: "2s", url: "" },
  {
    name: "e2e / rate-limit-burst",
    word: "failed",
    glyph: "error",
    tooltip: "cancelled",
    duration: "5m 02s",
    url: "",
  },
  { name: "unit", word: "running", glyph: "work", tooltip: null, duration: "4m 12s", url: "" },
  { name: "preview-deploy", word: "queued", glyph: "todo", tooltip: null, duration: "—", url: "" },
];

describe("ChecksList", () => {
  it("says the summary above one row per check", () => {
    renderWithStore(
      <ChecksList
        summary="1 of 5 passed · 2 not finished · 1 failed"
        rows={ROWS}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("1 of 5 passed · 2 not finished · 1 failed")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Checks" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "buildpassed1m 52s",
      "docsskipped2s",
      "e2e / rate-limit-burstfailed · cancelled5m 02s",
      "unitrunning4m 12s",
      "preview-deployqueued—",
    ]);
  });

  it("draws the glyph of each state", () => {
    renderWithStore(<ChecksList summary="" rows={ROWS} onOpen={() => {}} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]?.querySelector("svg")).not.toBeNull();
    expect(rows[2]?.querySelector('[data-state="error"]')).not.toBeNull();
    expect(rows[3]?.querySelector('[data-state="work"]')).not.toBeNull();
    expect(rows[4]?.querySelector('[data-state="todo"]')).not.toBeNull();
  });

  it("shows the conclusion of a failed check in the tooltip", async () => {
    const { user } = renderWithStore(<ChecksList summary="" rows={ROWS} onOpen={() => {}} />);
    await user.hover(screen.getByText("failed"));
    expect(await screen.findByRole("tooltip", {}, { timeout: 2000 })).toHaveTextContent(
      "cancelled",
    );
  });

  it("has no list without checks", () => {
    renderWithStore(<ChecksList summary="No checks" rows={[]} onOpen={() => {}} />);
    expect(screen.getByText("No checks")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("names a check with a url as an external link, and opens it without navigating", async () => {
    const onOpen = vi.fn();
    const rows: readonly CheckRowView[] = [
      {
        name: "build",
        word: "passed",
        glyph: "done",
        tooltip: null,
        duration: "1m 52s",
        url: "https://github.com/acme/web/actions/runs/1",
      },
    ];
    const { user } = renderWithStore(<ChecksList summary="" rows={rows} onOpen={onOpen} />);
    const link = screen.getByRole("link", { name: /build/ });
    expect(link).toHaveAttribute("href", "https://github.com/acme/web/actions/runs/1");

    await user.click(link);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith("https://github.com/acme/web/actions/runs/1");
  });

  it("keeps a check with no url as plain text", () => {
    renderWithStore(<ChecksList summary="" rows={ROWS} onOpen={() => {}} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keys rows by url so the same check name can repeat across workflows", () => {
    const rows: readonly CheckRowView[] = [
      {
        name: "build",
        word: "passed",
        glyph: "done",
        tooltip: null,
        duration: "1m",
        url: "https://github.com/acme/web/actions/runs/1",
      },
      {
        name: "build",
        word: "failed",
        glyph: "error",
        tooltip: null,
        duration: "2m",
        url: "https://github.com/acme/web/actions/runs/2",
      },
    ];
    renderWithStore(<ChecksList summary="" rows={rows} onOpen={() => {}} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.textContent)).toEqual(["buildpassed1m", "buildfailed2m"]);
  });
});
