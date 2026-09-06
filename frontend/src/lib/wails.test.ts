import { Call, Events } from "@wailsio/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asNoticeReason, asThemePreference } from "@/lib/wails";
import { makeState } from "@/test/wails-mock";

// The mock of @/lib/wails replaces the boundary; these cases exercise the real
// module against a fake runtime.
const wails = await vi.importActual<typeof import("@/lib/wails")>("@/lib/wails");

beforeEach(() => {
  vi.mocked(Call.ByID).mockClear();
  vi.mocked(Events.On).mockClear();
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

describe("api", () => {
  it("calls one binding per method", async () => {
    await wails.api.getState();
    await wails.api.openPath("/home/dev/projects");
    await wails.api.openFolderDialog();
    await wails.api.removeRecent("/home/dev/labs");
    await wails.api.dismissNotice();
    await wails.api.setTheme("dark");

    expect(Call.ByID).toHaveBeenCalledTimes(6);
    const ids = vi.mocked(Call.ByID).mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(6);
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
