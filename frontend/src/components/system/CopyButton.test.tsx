import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { CopyButton } from "./CopyButton";

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe("CopyButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies the text and says Copied, announced", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = renderWithStore(
      <CopyButton variant="icon" label="Copy gh auth login" text="gh auth login" />,
    );
    stubClipboard(writeText);
    await user.click(screen.getByRole("button", { name: "Copy gh auth login" }));
    expect(writeText).toHaveBeenCalledWith("gh auth login");
    expect(await screen.findAllByText("Copied")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("goes back to the copy after two seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderWithStore(<CopyButton variant="page" label="Copy the list" text="x" />);
    stubClipboard(() => Promise.resolve());
    await user.click(screen.getByRole("button", { name: "Copy the list" }));
    expect(await screen.findAllByText("Copied")).not.toHaveLength(0);
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  it("says it can't copy, as an alert, until the next click", async () => {
    const { user } = renderWithStore(<CopyButton variant="page" label="Copy the list" text="x" />);
    stubClipboard(() => Promise.reject(new Error("denied")));
    await user.click(screen.getByRole("button", { name: "Copy the list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't copy · select the text");
    stubClipboard(() => Promise.resolve());
    await user.click(screen.getByRole("button", { name: "Copy the list" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the label as text in the page variant and only as a name in the icon one", () => {
    renderWithStore(<CopyButton variant="page" label="Copy the list" text="x" />);
    expect(screen.getByText("Copy the list")).toBeInTheDocument();
  });

  it("names the icon variant without writing the label", () => {
    renderWithStore(<CopyButton variant="icon" label="Copy the error" text="x" />);
    expect(screen.getByRole("button", { name: "Copy the error" })).toBeInTheDocument();
    expect(screen.queryByText("Copy the error")).not.toBeInTheDocument();
  });
});
