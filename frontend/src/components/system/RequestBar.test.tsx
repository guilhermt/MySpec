import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";
import { OtherConversationBar, RequestBar } from "./RequestBar";

function bar() {
  return screen.getByRole("region", { name: "Request" });
}

describe("RequestBar", () => {
  it("asks quietly, leading to the card that holds the answer", () => {
    renderWithStore(
      <RequestBar
        form="quiet"
        glyph="wait"
        label="Question"
        place="Reviewer"
        time={{ short: "18m", long: "18 minutes", tone: "wait" }}
        status="Question from the Reviewer"
        actions={<Button size="sm">Show</Button>}
      />,
    );

    expect(bar()).toHaveAttribute("data-form", "quiet");
    expect(bar()).toHaveTextContent("Question· Reviewer");
    expect(within(bar()).getByText("waiting for you, 18 minutes")).toBeInTheDocument();
    expect(within(bar()).getByRole("status")).toHaveTextContent("Question from the Reviewer");
    expect(within(bar()).getByRole("button", { name: "Show" })).toBeInTheDocument();
  });

  it("holds the action itself when the request has no card", () => {
    renderWithStore(
      <RequestBar
        form="tinted"
        glyph="wait"
        label="Ready to continue"
        place="Tech spec"
        status="Ready to continue to the tech spec"
        actions={<Button size="sm">Continue</Button>}
      />,
    );

    expect(bar()).toHaveAttribute("data-form", "tinted");
    expect(bar()).toHaveTextContent("Ready to continue· Tech spec");
    expect(within(bar()).getByRole("status")).toHaveTextContent(
      "Ready to continue to the tech spec",
    );
    expect(within(bar()).getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("counts a decision and keeps its primary dashed until everything is decided", () => {
    renderWithStore(
      <RequestBar
        form="decision"
        glyph="wait"
        label="Decide findings"
        place="PR review · pass 1"
        time={{ short: "12m", long: "12 minutes", tone: "wait" }}
        progress="1 of 4 decided"
        status="Decide findings, 1 of 4 decided"
        actions={
          <>
            <Button size="sm" shortcut="Alt ↓">
              Next to decide
            </Button>
            <Button size="sm" variant="primary" disabled disabledReason="Decide 3 more">
              Apply approved
            </Button>
          </>
        }
      />,
    );

    expect(bar()).toHaveAttribute("data-form", "decision");
    expect(within(bar()).getByText("1 of 4 decided")).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: /Next to decide/ })).toBeInTheDocument();
    expect(
      within(bar()).getByRole("button", { name: "Apply approved" }),
    ).toHaveAccessibleDescription("Decide 3 more");
  });

  it("says a session stopped, with the retry of the one that stopped", () => {
    renderWithStore(
      <RequestBar
        form="error"
        glyph="error"
        label="Session error"
        place="Reviewer · pass 2"
        time={{ short: "5m", long: "5 minutes", tone: "error" }}
        status="The reviewer's session stopped"
        actions={
          <Button size="sm" variant="primary">
            Retry reviewer
          </Button>
        }
      />,
    );

    expect(bar()).toHaveAttribute("data-form", "error");
    expect(bar()).toHaveTextContent("Session error· Reviewer · pass 2");
    expect(within(bar()).getByText("error, waiting for you, 5 minutes")).toBeInTheDocument();
    expect(within(bar()).getByRole("status")).toHaveTextContent("The reviewer's session stopped");
    expect(within(bar()).getByRole("button", { name: "Retry reviewer" })).toBeInTheDocument();
  });

  it("offers to close a merged task, saying what closing does", () => {
    renderWithStore(
      <RequestBar
        form="closing"
        glyph="close"
        label="Ready to close"
        place="#1284 merged"
        time={{ short: "2h", long: "2 hours", tone: "close" }}
        progress="Removes the worktree and the branch, then updates dev"
        status="Ready to close"
        actions={
          <Button size="sm" variant="primary">
            Close task
          </Button>
        }
      />,
    );

    expect(bar()).toHaveAttribute("data-form", "closing");
    expect(bar()).toHaveTextContent("Ready to close· #1284 merged");
    expect(within(bar()).getByText("ready to close, 2 hours")).toBeInTheDocument();
    expect(
      within(bar()).getByText("Removes the worktree and the branch, then updates dev"),
    ).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Close task" })).toBeInTheDocument();
  });
});

describe("RequestBar, the flash and the tooltip of the middle", () => {
  it("blinks in the veil of its gravity while the situation flashes", () => {
    renderWithStore(
      <RequestBar
        form="error"
        glyph="error"
        label="PR blocked"
        status=""
        flash="error"
        actions={null}
      />,
    );

    expect(bar()).toHaveClass("situation-flash");
    expect(bar()).toHaveAttribute("data-flash", "error");
  });

  it("does not blink otherwise", () => {
    renderWithStore(
      <RequestBar form="error" glyph="error" label="PR blocked" status="" actions={null} />,
    );

    expect(bar()).not.toHaveAttribute("data-flash");
  });

  it("says the reason behind the middle in its tooltip", async () => {
    const { user } = renderWithStore(
      <RequestBar
        form="closing"
        glyph="close"
        label="Ready to close"
        progress="Couldn't confirm the merge"
        progressTooltip="gh: not authenticated"
        status=""
        actions={null}
      />,
    );

    await user.hover(within(bar()).getByText("Couldn't confirm the merge"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("gh: not authenticated");
  });
});

describe("OtherConversationBar", () => {
  it("says where Go leads in its tooltip, and blinks while the other situation flashes", async () => {
    const { user } = renderWithStore(
      <OtherConversationBar
        failed={false}
        label="The reviewer waits · Question"
        status=""
        onGo={vi.fn()}
        goLabel="Go to reviewer"
        goTooltip="Show the reviewer's conversation"
        flash="wait"
      />,
    );

    expect(bar()).toHaveAttribute("data-flash", "wait");
    expect(within(bar()).getByRole("status")).toHaveTextContent(/^$/);
    await user.hover(within(bar()).getByRole("button", { name: "Go to reviewer" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Show the reviewer's conversation",
    );
  });

  it("says the other conversation waits and leads there", async () => {
    const onGo = vi.fn();
    const { user } = renderWithStore(
      <OtherConversationBar
        failed={false}
        label="The reviewer waits · Question"
        time={{ short: "18m", long: "18 minutes" }}
        onGo={onGo}
        goLabel="Go to reviewer"
      />,
    );

    expect(bar()).toHaveAttribute("data-form", "other-waits");
    expect(within(bar()).getByRole("status")).toHaveTextContent("The reviewer waits · Question");
    expect(within(bar()).getByText("waiting for you, 18 minutes")).toBeInTheDocument();

    await user.click(within(bar()).getByRole("button", { name: "Go to reviewer" }));

    expect(onGo).toHaveBeenCalledOnce();
  });

  it("says the other conversation failed", () => {
    renderWithStore(
      <OtherConversationBar
        failed
        label="Session error · Reviewer · pass 2"
        onGo={vi.fn()}
        goLabel="Go to reviewer"
      />,
    );

    expect(bar()).toHaveAttribute("data-form", "other-failed");
    expect(within(bar()).getByRole("status")).toHaveTextContent(
      "Session error · Reviewer · pass 2",
    );
    expect(within(bar()).getByRole("button", { name: "Go to reviewer" })).toBeInTheDocument();
  });
});
