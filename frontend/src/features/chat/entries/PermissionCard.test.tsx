import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PermissionCard } from "@/features/chat/entries/PermissionCard";
import { api, type PermissionEntry } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeEntry } from "@/test/wails-mock";

function permission(overrides: Partial<PermissionEntry> = {}): PermissionEntry {
  const entry = makeEntry("permission");
  if (entry.permission === null) {
    throw new Error("the permission fixture has no payload");
  }
  return { ...entry.permission, suggestions: '[{"type":"addRules"}]', ...overrides };
}

describe("PermissionCard", () => {
  it("shows the tool and what it wants to run", () => {
    renderWithStore(<PermissionCard stage="prd" taskId="task-1" permission={permission()} />);

    expect(screen.getByRole("group", { name: "Permission needed" })).toBeInTheDocument();
    expect(screen.getByText("Bash")).toBeInTheDocument();
    expect(screen.getByText("List the working directory")).toBeInTheDocument();
    expect(screen.getByText("ls")).toBeInTheDocument();
  });

  it("shows the path of a file tool and the raw input of anything else", () => {
    const { unmount } = renderWithStore(
      <PermissionCard
        stage="prd"
        taskId="task-1"
        permission={permission({ tool: "Write", input: '{"file_path":"src/main.tsx"}' })}
      />,
    );

    expect(screen.getByText("src/main.tsx")).toBeInTheDocument();
    unmount();

    renderWithStore(
      <PermissionCard
        stage="prd"
        taskId="task-1"
        permission={permission({ tool: "WebFetch", input: '{"url":"https://example.com"}' })}
      />,
    );

    expect(screen.getByText(/"url": "https:\/\/example.com"/)).toBeInTheDocument();
  });

  it("allows the tool once", async () => {
    const { user } = renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission()} />,
    );

    await user.click(screen.getByRole("button", { name: "Allow" }));

    expect(api.answerPermission).toHaveBeenCalledWith("task-1", "prd", "req-1", "allow", "");
  });

  it("allows the tool for the whole session", async () => {
    const { user } = renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission()} />,
    );

    await user.click(screen.getByRole("button", { name: "Allow for this session" }));

    expect(api.answerPermission).toHaveBeenCalledWith(
      "task-1",
      "prd",
      "req-1",
      "allow_session",
      "",
    );
  });

  it.each([
    ["the CLI suppresses it", { suppressAlwaysAllow: true }],
    ["there is no rule to remember", { suggestions: "" }],
  ])("hides the session answer when %s", (_reason, overrides) => {
    renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission(overrides)} />,
    );

    expect(
      screen.queryByRole("button", { name: "Allow for this session" }),
    ).not.toBeInTheDocument();
  });

  it("asks what to do instead before denying", async () => {
    const { user } = renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission()} />,
    );

    await user.click(screen.getByRole("button", { name: "Deny" }));
    expect(api.answerPermission).not.toHaveBeenCalled();

    await user.type(
      screen.getByRole("textbox", { name: "Tell the agent what to do instead (optional)" }),
      "read it first",
    );
    await user.click(screen.getByRole("button", { name: "Confirm deny" }));

    expect(api.answerPermission).toHaveBeenCalledWith(
      "task-1",
      "prd",
      "req-1",
      "deny",
      "read it first",
    );
  });

  it("takes the denial back", async () => {
    const { user } = renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission()} />,
    );

    await user.click(screen.getByRole("button", { name: "Deny" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Allow" })).toBeInTheDocument();
    expect(api.answerPermission).not.toHaveBeenCalled();
  });

  it("puts the focus on Allow, unless the CLI wants a deliberate answer", () => {
    const { unmount } = renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission()} />,
    );

    expect(screen.getByRole("button", { name: "Allow" })).toHaveFocus();
    unmount();

    renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission({ defaultToNo: true })} />,
    );

    expect(screen.getByRole("button", { name: "Allow" })).not.toHaveFocus();
  });

  it.each([
    ["allowed", "Allowed"],
    ["allowed_session", "Allowed for this session"],
    ["cancelled", "Cancelled before an answer"],
  ] as const)("reports the answer that was given: %s", (status, expected) => {
    renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission({ status })} />,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allow" })).not.toBeInTheDocument();
  });

  it("carries the message along with a denial", () => {
    renderWithStore(
      <PermissionCard
        stage="prd"
        taskId="task-1"
        permission={permission({ status: "denied", denyMessage: "read it first" })}
      />,
    );

    expect(screen.getByText("Denied · read it first")).toBeInTheDocument();
  });

  it("explains why the CLI stopped the tool", () => {
    renderWithStore(
      <PermissionCard
        stage="prd"
        taskId="task-1"
        permission={permission({
          decisionReason: "no rule matched",
          blockedPath: "/etc/hosts",
        })}
      />,
    );

    expect(screen.getByText("no rule matched")).toBeInTheDocument();
    expect(screen.getByText("Outside the working directory: /etc/hosts")).toBeInTheDocument();
  });

  it("reads a permission of an earlier conversation with the tool and the command, and no answer", () => {
    renderWithStore(
      <PermissionCard stage="prd" taskId="task-1" permission={permission()} readOnly />,
    );

    expect(screen.getByText("Bash")).toBeInTheDocument();
    expect(screen.getByText("ls")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("gives the decision of a permission of an earlier conversation when there was one", () => {
    renderWithStore(
      <PermissionCard
        stage="prd"
        taskId="task-1"
        permission={permission({ status: "denied", denyMessage: "Use the script" })}
        readOnly
      />,
    );

    expect(screen.getByText("Denied · Use the script")).toBeInTheDocument();
  });
});
