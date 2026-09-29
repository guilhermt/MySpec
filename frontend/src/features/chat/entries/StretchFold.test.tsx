import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { StretchFoldView } from "@/features/chat/conversation";
import { StretchFold } from "@/features/chat/entries/StretchFold";

const FOLD: StretchFoldView = {
  text: "5 speeches · 71 actions",
  from: "from the start · steps/06-throttle-metrics.md",
  interval: "16:12–16:48",
  name: "Earlier: 5 speeches and 71 actions, from the start · steps/06-throttle-metrics.md, 16:12 to 16:48",
};

function Fold({ fold = FOLD }: { fold?: StretchFoldView }) {
  const [open, setOpen] = useState(false);
  return (
    <StretchFold fold={fold} open={open} onToggle={() => setOpen(!open)}>
      <p>Speech 1.</p>
    </StretchFold>
  );
}

describe("StretchFold", () => {
  it("folds the stretch into one line with its size, where it began and its interval", () => {
    render(<Fold />);

    const article = screen.getByRole("article", { name: FOLD.name });
    expect(article).toHaveAttribute("data-feed-item");
    expect(article).toHaveTextContent("5 speeches · 71 actions");
    expect(article).toHaveTextContent("from the start · steps/06-throttle-metrics.md");
    expect(screen.getByText("16:12–16:48")).toHaveClass("entry-time");
  });

  it("doesn't mount the entries of a folded stretch, and shows them open", async () => {
    const user = userEvent.setup();
    render(<Fold />);
    const toggle = screen.getByRole("button", { name: /5 speeches · 71 actions/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("data-feed-toggle");
    expect(screen.queryByText("Speech 1.")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Speech 1.")).toBeInTheDocument();

    await user.click(toggle);

    expect(screen.queryByText("Speech 1.")).not.toBeInTheDocument();
  });

  it("has no interval without the times", () => {
    render(<Fold fold={{ ...FOLD, interval: "" }} />);

    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });
});
