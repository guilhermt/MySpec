import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/wails";
import { dismissNotice, openFolderDialog, openPath, removeRecent, setTheme } from "@/store/actions";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";

beforeEach(() => {
  resetAppStore();
});

describe("actions", () => {
  it("delegate to the matching binding", async () => {
    await openPath("/home/dev/projects");
    await openFolderDialog();
    await removeRecent("/home/dev/labs");
    await dismissNotice();
    await setTheme("dark");

    expect(api.openPath).toHaveBeenCalledWith("/home/dev/projects");
    expect(api.openFolderDialog).toHaveBeenCalledOnce();
    expect(api.removeRecent).toHaveBeenCalledWith("/home/dev/labs");
    expect(api.dismissNotice).toHaveBeenCalledOnce();
    expect(api.setTheme).toHaveBeenCalledWith("dark");
    expect(useAppStore.getState().error).toBeNull();
  });

  it("stores the message of a rejected binding", async () => {
    vi.mocked(api.openPath).mockRejectedValueOnce(new Error("open failed"));

    await openPath("/home/dev/gone");

    expect(useAppStore.getState().error).toBe("open failed");
  });

  it("stores a rejection that is not an Error", async () => {
    vi.mocked(api.dismissNotice).mockRejectedValueOnce("boom");

    await dismissNotice();

    expect(useAppStore.getState().error).toBe("boom");
  });

  it("leaves the snapshot untouched", async () => {
    await openPath("/home/dev/projects");

    expect(useAppStore.getState().app).toBeNull();
  });
});
