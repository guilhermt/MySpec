import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { AppNotice } from "./AppNotice";

function notice(onDismiss = vi.fn()) {
  const result = renderWithStore(
    <AppNotice
      label="Couldn't pause Rate limit per API key"
      detail="The session didn't answer in 10 seconds. Try again."
      onDismiss={onDismiss}
    />,
  );
  return { ...result, onDismiss };
}

describe("AppNotice", () => {
  it("says which action failed and what to do, as an alert", () => {
    notice();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't pause Rate limit per API key");
    expect(alert).toHaveTextContent("The session didn't answer in 10 seconds. Try again.");
  });

  it("goes away on Dismiss", async () => {
    const { user, onDismiss } = notice();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
