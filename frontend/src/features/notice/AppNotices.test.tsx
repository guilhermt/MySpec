import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppNotices } from "@/features/notice/AppNotices";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";

const ERROR = { label: "Couldn't pause add-login", detail: "no session. Try again." };

describe("AppNotices", () => {
  it("says which action failed and what to do", () => {
    renderWithStore(<AppNotices />, { ui: { error: ERROR } });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't pause add-login");
    expect(alert).toHaveTextContent("no session. Try again.");
  });

  it("lets the failure be dismissed", async () => {
    const { user } = renderWithStore(<AppNotices />, { ui: { error: ERROR } });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(useAppStore.getState().error).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says nothing when nothing failed", () => {
    const { container } = renderWithStore(<AppNotices />);

    expect(container).toBeEmptyDOMElement();
  });
});
