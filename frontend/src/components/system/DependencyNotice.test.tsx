import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DependencyNotice } from "./DependencyNotice";

const MODEL = {
  title: "Depends on #461",
  issueTitle: "Metering events from the gateway",
  meta: "acme/gateway · Open · Backlog · no pull request. A warning only: it never blocks.",
};

describe("DependencyNotice", () => {
  it("says what the card depends on and the state of it", () => {
    render(<DependencyNotice model={MODEL} />);
    expect(screen.getByText("Depends on #461")).toBeInTheDocument();
    expect(screen.getByText("Metering events from the gateway", { exact: false })).toBeVisible();
    expect(screen.getByText(MODEL.meta)).toBeInTheDocument();
  });

  it("hides the diamond from the reader", () => {
    render(<DependencyNotice model={MODEL} />);
    expect(screen.getByText("◇", { exact: false, selector: "span" })).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
