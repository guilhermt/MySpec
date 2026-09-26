import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Link } from "./Link";

describe("Link", () => {
  it("is a link with its name", () => {
    renderWithStore(<Link href="#pr">PR #48</Link>);
    expect(screen.getByRole("link", { name: "PR #48" })).toHaveClass("text-brand-ink");
  });

  it("shows the external icon", () => {
    renderWithStore(
      <Link href="#pr" external>
        PR #48
      </Link>,
    );
    expect(screen.getByRole("link", { name: "PR #48" }).querySelector("svg")).not.toBeNull();
  });

  it("is not a link when unavailable", () => {
    renderWithStore(
      <Link href="#pr" unavailable>
        PR #48
      </Link>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("PR #48")).toHaveClass("text-ink-4");
  });

  it("is busy while loading", () => {
    renderWithStore(
      <Link href="#pr" loading loadingLabel="Opening PR…">
        PR #48
      </Link>,
    );
    expect(screen.getByText("Opening PR…")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the reason of an error", () => {
    renderWithStore(
      <Link href="#pr" error="could not open">
        PR #48
      </Link>,
    );
    expect(screen.getByText("could not open", { exact: false })).toHaveClass("text-state-error");
    expect(screen.getByText("✕")).toHaveAttribute("aria-hidden", "true");
  });

  it("needs a destination, by its type", () => {
    // @ts-expect-error: a link without a destination is a button.
    const nowhere = <Link>PR #48</Link>;
    expect(nowhere.props.children).toBe("PR #48");
  });

  it("shows the focus ring on keyboard focus", async () => {
    const { user } = renderWithStore(<Link href="#pr">PR #48</Link>);
    await user.tab();
    const link = screen.getByRole("link", { name: "PR #48" });
    expect(link).toHaveFocus();
    expect(link).toHaveClass("focus-visible:focus-ring");
  });

  it("brings the underline to full color on hover", () => {
    renderWithStore(<Link href="#pr">PR #48</Link>);
    expect(screen.getByRole("link", { name: "PR #48" })).toHaveClass("hover:decoration-current");
  });
});
