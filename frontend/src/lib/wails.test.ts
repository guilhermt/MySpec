import { Browser, Call, Events } from "@wailsio/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asActionStatus,
  asEntryKind,
  asErrorKind,
  asMarkerType,
  asNoticeReason,
  asPermissionStatus,
  asSessionStatus,
  asTaskStage,
  asThemePreference,
  asTranscriptEventKind,
} from "@/lib/wails";
import { makeState } from "@/test/wails-mock";

// The mock of @/lib/wails replaces the boundary; these cases exercise the real
// module against a fake runtime.
const wails = await vi.importActual<typeof import("@/lib/wails")>("@/lib/wails");

beforeEach(() => {
  vi.mocked(Call.ByID).mockClear();
  vi.mocked(Events.On).mockClear();
  vi.mocked(Browser.OpenURL).mockClear();
});

describe("asThemePreference", () => {
  it("keeps the known preferences", () => {
    expect(asThemePreference("light")).toBe("light");
    expect(asThemePreference("dark")).toBe("dark");
    expect(asThemePreference("system")).toBe("system");
  });

  it("falls back to system", () => {
    expect(asThemePreference("sepia")).toBe("system");
  });
});

describe("asNoticeReason", () => {
  it("keeps the known reasons", () => {
    expect(asNoticeReason("not_found")).toBe("not_found");
    expect(asNoticeReason("not_directory")).toBe("not_directory");
    expect(asNoticeReason("not_readable")).toBe("not_readable");
    expect(asNoticeReason("last_recent_missing")).toBe("last_recent_missing");
  });

  it("falls back to not_readable", () => {
    expect(asNoticeReason("whatever")).toBe("not_readable");
  });
});

describe("narrowing", () => {
  it("keeps the values Go sends", () => {
    expect(asTaskStage("prd_done")).toBe("prd_done");
    expect(asSessionStatus("needs_permission")).toBe("needs_permission");
    expect(asEntryKind("permission")).toBe("permission");
    expect(asActionStatus("interrupted")).toBe("interrupted");
    expect(asPermissionStatus("allowed_session")).toBe("allowed_session");
    expect(asMarkerType("prd_updated")).toBe("prd_updated");
    expect(asErrorKind("not_logged_in")).toBe("not_logged_in");
    expect(asTranscriptEventKind("text")).toBe("text");
  });

  it("falls back on a value a newer backend invented", () => {
    expect(asTaskStage("tech_spec")).toBe("prd");
    expect(asSessionStatus("hibernating")).toBe("waiting");
    expect(asEntryKind("diagram")).toBe("marker");
    expect(asActionStatus("queued")).toBe("done");
    expect(asPermissionStatus("expired")).toBe("cancelled");
    expect(asMarkerType("branched")).toBe("compacted");
    expect(asErrorKind("out_of_quota")).toBe("turn_error");
    expect(asTranscriptEventKind("patch")).toBe("reset");
  });
});

describe("api", () => {
  it("calls one binding per method", async () => {
    await wails.api.getState();
    await wails.api.openPath("/home/dev/projects");
    await wails.api.openFolderDialog();
    await wails.api.removeRecent("/home/dev/labs");
    await wails.api.dismissNotice();
    await wails.api.setTheme("dark");

    await wails.api.createTask({ name: "add-login", repoPath: "", initialContext: "a login" });
    await wails.api.deleteTask("task-1");
    await wails.api.getTranscript("task-1");
    await wails.api.sendMessage("task-1", "go on");
    await wails.api.removePending("task-1", "entry-1");
    await wails.api.interrupt("task-1");
    await wails.api.pause("task-1");
    await wails.api.resume("task-1");
    await wails.api.retry("task-1");
    await wails.api.answerPermission("task-1", "req-1", "allow", "");
    await wails.api.answerQuestion("task-1", "req-1", { "Which database?": "SQLite" });
    await wails.api.readArtifact("task-1", "PRD.md");

    expect(Call.ByID).toHaveBeenCalledTimes(18);
    const ids = vi.mocked(Call.ByID).mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(18);
  });

  it("opens a link in the browser of the desktop, never in the webview", async () => {
    await wails.api.openExternal("https://anthropic.com");

    expect(Browser.OpenURL).toHaveBeenCalledWith("https://anthropic.com");
    expect(Call.ByID).not.toHaveBeenCalled();
  });
});

describe("onTranscriptChanged", () => {
  it("hands the event payload to the handler", () => {
    const handler = vi.fn();
    const event = { taskId: "task-1", kind: "reset", entry: null, entryId: "", text: "" };

    wails.onTranscriptChanged(handler);
    const registered = vi.mocked(Events.On).mock.calls[0]?.[1];
    registered?.({ name: "transcript:changed", data: event });

    expect(vi.mocked(Events.On).mock.calls[0]?.[0]).toBe("transcript:changed");
    expect(handler).toHaveBeenCalledWith(event);
  });
});

describe("onStateChanged", () => {
  it("hands the event payload to the handler and returns the unsubscribe", () => {
    const unsubscribe = vi.fn();
    vi.mocked(Events.On).mockReturnValueOnce(unsubscribe);
    const handler = vi.fn();
    const state = makeState();

    const stop = wails.onStateChanged(handler);
    const registered = vi.mocked(Events.On).mock.calls[0]?.[1];
    registered?.({ name: "state:changed", data: state });

    expect(vi.mocked(Events.On).mock.calls[0]?.[0]).toBe("state:changed");
    expect(handler).toHaveBeenCalledWith(state);
    expect(stop).toBe(unsubscribe);
  });
});
