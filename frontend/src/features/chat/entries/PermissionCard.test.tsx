import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PermissionCard } from "@/features/chat/entries/PermissionCard";
import { api, type PermissionEntry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeEntry } from "@/test/wails-mock";

const AT = "2026-09-29T09:14:00Z";

function permission(overrides: Partial<PermissionEntry> = {}): PermissionEntry {
  const entry = makeEntry("permission");
  if (entry.permission === null) {
    throw new Error("the permission fixture has no payload");
  }
  return { ...entry.permission, ...overrides };
}

const OFFERED = permission({ suggestions: '[{"type":"addRules"}]' });

function card(p: PermissionEntry = permission(), readOnly = false) {
  return renderWithStore(
    <PermissionCard
      stage="prd"
      taskId="task-1"
      permission={p}
      createdAt={AT}
      readOnly={readOnly}
    />,
  );
}

describe("PermissionCard pending", () => {
  it("shows the tool, the description and the command once", () => {
    card();

    expect(screen.getByRole("article")).toHaveAttribute("data-pending-card", "permission");
    expect(screen.getByText("Bash")).toBeInTheDocument();
    expect(screen.getByText("List the working directory")).toBeInTheDocument();
    expect(screen.getByText("ls")).toBeInTheDocument();
  });

  it("shows the path of a file tool, the reason and the path outside", () => {
    card(
      permission({
        tool: "Write",
        displayName: "Write",
        input: '{"file_path":"/etc/hosts","content":"x"}',
        decisionReason: "Writes outside the project",
        blockedPath: "/etc",
      }),
    );

    expect(screen.getByText("/etc/hosts")).toBeInTheDocument();
    expect(screen.getByText("Writes outside the project")).toBeInTheDocument();
    expect(screen.getByText("Outside the working directory: /etc")).toBeInTheDocument();
  });

  it("allows with the primary, which has the default focus", async () => {
    const { user } = card();

    const allow = screen.getByRole("button", { name: /Allow/ });
    expect(allow).toHaveAttribute("data-variant", "primary");
    expect(allow).toHaveAttribute("data-default-focus");

    await user.click(allow);

    expect(api.answerPermission).toHaveBeenCalledWith("task-1", "prd", "req-1", "allow", "");
  });

  it("offers Allow for this session only with a rule to remember", async () => {
    const { user, unmount } = card();
    expect(screen.queryByRole("button", { name: /Allow for this session/ })).toBeNull();
    unmount();

    card(OFFERED);
    await user.click(screen.getByRole("button", { name: /Allow for this session/ }));

    expect(api.answerPermission).toHaveBeenCalledWith(
      "task-1",
      "prd",
      "req-1",
      "allow_session",
      "",
    );
  });

  it("hides Allow for this session when the CLI suppresses it", () => {
    card(permission({ suggestions: '[{"type":"addRules"}]', suppressAlwaysAllow: true }));

    expect(screen.queryByRole("button", { name: /Allow for this session/ })).toBeNull();
  });

  it("opens the text of Deny… in the card, with Deny dangerous and Cancel", async () => {
    const { user } = card();

    await user.click(screen.getByRole("button", { name: /Deny…/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Tell the agent what to do instead (optional)" }),
      "Use git status",
    );
    const deny = screen.getByRole("button", { name: "Deny" });
    expect(deny).toHaveAttribute("data-variant", "danger");

    await user.click(deny);

    expect(api.answerPermission).toHaveBeenCalledWith(
      "task-1",
      "prd",
      "req-1",
      "deny",
      "Use git status",
    );
  });

  it("goes back to the buttons with Cancel", async () => {
    const { user } = card();

    await user.click(screen.getByRole("button", { name: /Deny…/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: /Allow/ })).toBeInTheDocument();
  });

  it("starts on Deny… with defaultToNo", () => {
    card(permission({ defaultToNo: true }));

    expect(screen.getByRole("button", { name: /Deny…/ })).toHaveAttribute("data-default-focus");
    expect(screen.getByRole("button", { name: /Allow/ })).not.toHaveAttribute("data-default-focus");
  });

  it("answers 1 to 3 as the buttons, with the focus on the card", async () => {
    const { user } = card(OFFERED);

    screen.getByRole("article").focus();
    await user.keyboard("2");

    expect(api.answerPermission).toHaveBeenCalledWith(
      "task-1",
      "prd",
      "req-1",
      "allow_session",
      "",
    );
  });

  it("takes the last key to Deny… without the middle button", async () => {
    const { user } = card();

    screen.getByRole("button", { name: /Allow/ }).focus();
    await user.keyboard("2");

    expect(
      screen.getByRole("textbox", { name: "Tell the agent what to do instead (optional)" }),
    ).toBeInTheDocument();
  });

  it("says the gerund while sending, with the other buttons off", async () => {
    vi.mocked(api.answerPermission).mockReturnValueOnce(new Promise<void>(() => {}));
    const { user } = card();

    await user.click(screen.getByRole("button", { name: /Allow/ }));

    expect(screen.getByRole("button", { name: "Allowing…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /Deny…/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("tells the failure at its foot and gives the buttons back", async () => {
    vi.mocked(api.answerPermission).mockRejectedValueOnce(new Error("the session stopped"));
    const { user } = card();

    await user.click(screen.getByRole("button", { name: /Allow/ }));

    expect(await screen.findByText("Not sent · the session stopped")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Allow/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(useAppStore.getState().error).toBeNull();
  });
});

describe("PermissionCard settled", () => {
  it("is flat with the decision and its time in the tooltip", async () => {
    const { user } = card(permission({ status: "allowed", answeredAt: "2026-09-29T09:19:00Z" }));

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await user.hover(screen.getByText("Allowed"));

    expect(await screen.findByText(/^Allowed at /)).toBeInTheDocument();
  });

  it("says the message of a denial", () => {
    card(permission({ status: "denied", denyMessage: "Not now" }));

    expect(screen.getByText("Denied · Not now")).toBeInTheDocument();
  });

  it("says a cancelled request", () => {
    card(permission({ status: "cancelled" }));

    expect(screen.getByText("Cancelled before an answer")).toBeInTheDocument();
  });

  it("takes no answer in an earlier conversation", () => {
    card(permission(), true);

    expect(screen.getByText("List the working directory")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
