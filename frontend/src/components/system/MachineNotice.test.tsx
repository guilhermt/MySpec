import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MachineNotice } from "@/components/system/MachineNotice";

function setup() {
  const onOpen = vi.fn();
  const onDismiss = vi.fn();
  render(
    <MachineNotice
      title="Claude Code isn't logged in"
      text="Sessions won't start."
      onOpen={onOpen}
      onDismiss={onDismiss}
    />,
  );
  return { onOpen, onDismiss, user: userEvent.setup() };
}

describe("MachineNotice", () => {
  it("is a status with the title and the text", () => {
    setup();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Claude Code isn't logged in");
    expect(status).toHaveTextContent("Sessions won't start.");
  });

  it("opens Settings › Machine", async () => {
    const { onOpen, user } = setup();

    await user.click(screen.getByRole("button", { name: "Open Settings › Machine" }));

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("can be dismissed", async () => {
    const { onDismiss, user } = setup();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
