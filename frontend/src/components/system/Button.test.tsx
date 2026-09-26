import { screen } from "@testing-library/react";
import { Check } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";

describe("Button", () => {
  it("is a button named by its label, with the icon hidden", () => {
    renderWithStore(
      <Button variant="primary" icon={Check}>
        Approve
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Approve" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("takes the focus", async () => {
    const { user } = renderWithStore(<Button>Approve</Button>);
    await user.tab();
    expect(screen.getByRole("button", { name: "Approve" })).toHaveFocus();
  });

  it("stays focusable while disabled and tells the reason", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <Button disabled disabledReason="Finish the step first" onClick={onClick}>
        Approve
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Approve" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Finish the step first");
    await user.tab();
    expect(button).toHaveFocus();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("points to a reason elsewhere", () => {
    renderWithStore(
      <>
        <p id="footer-reason">Resolve the conflicts first</p>
        <Button disabled reasonId="footer-reason">
          Merge
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Merge" })).toHaveAccessibleDescription(
      "Resolve the conflicts first",
    );
  });

  it("is busy while loading and ignores the click", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <Button variant="primary" loading loadingLabel="Approving…" onClick={onClick}>
        Approve
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Approving…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("requires the gerund to load, by its type", () => {
    // @ts-expect-error: a loading button without its gerund would have no name.
    const unnamed = <Button loading>Approve</Button>;
    expect(unnamed.props.loading).toBe(true);
  });

  it("calls the handler when clicked", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(<Button onClick={onClick}>Approve</Button>);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps the key out of the accessible name", () => {
    renderWithStore(
      <Button variant="primary" shortcut="Ctrl ↵">
        Publish review…
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Publish review…" })).toHaveTextContent("Ctrl ↵");
  });

  it("marks the pressed ghost", () => {
    renderWithStore(
      <Button variant="ghost" pressed>
        Diff
      </Button>,
    );
    const diff = screen.getByRole("button", { name: "Diff" });
    expect(diff).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps its name and its click in the error state", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <Button error onClick={onClick}>
        Try again
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps the key of a quiet button out of its name too", () => {
    renderWithStore(
      <Button size="xs" icon={Check} shortcut="Esc">
        Cancel
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveTextContent("Esc");
  });
});
