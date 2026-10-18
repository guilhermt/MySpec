import { describe, expect, it } from "vitest";
import {
  availableAnnouncement,
  availableText,
  failureReason,
  INSTALL_FAILURE_TITLE,
  installAnnouncement,
  installedText,
  installFailureReason,
  installFailureRemedy,
  newlyAvailable,
  restartText,
  UP_TO_DATE,
  UPDATING,
  updateLabel,
  updatingText,
} from "@/lib/update";
import {
  makeUpdate,
  makeUpdateInstall,
  makeUpdateInstallFailure,
  makeUpdateRelease,
} from "@/test/wails-mock";

describe("availableText", () => {
  it("says the version is available", () => {
    expect(availableText("0.5.0")).toBe("MySpec 0.5.0 is available");
  });
});

describe("availableAnnouncement", () => {
  it("ends the text with a period", () => {
    expect(availableAnnouncement("0.5.0")).toBe("MySpec 0.5.0 is available.");
  });
});

describe("newlyAvailable", () => {
  it.each([
    ["from none to a version", "", "0.5.0", "0.5.0"],
    ["from a version to a newer one", "0.5.0", "0.6.0", "0.6.0"],
    ["the same version", "0.5.0", "0.5.0", null],
    ["a version that went away", "0.5.0", "", null],
  ])("%s", (_name, before, after, expected) => {
    expect(newlyAvailable(makeUpdate({ latest: before }), makeUpdate({ latest: after }))).toBe(
      expected,
    );
  });

  it("counts a missing previous state as nothing known", () => {
    expect(newlyAvailable(undefined, makeUpdate({ latest: "0.5.0" }))).toBe("0.5.0");
    expect(newlyAvailable(undefined, makeUpdate())).toBeNull();
    expect(newlyAvailable(undefined, undefined)).toBeNull();
  });
});

describe("failureReason", () => {
  it.each([
    ["offline", "x", "No connection to GitHub."],
    ["rate_limited", "x", "GitHub's rate limit was reached. Try again later."],
    ["timeout", "x", "GitHub didn't answer in time."],
    ["failed", "GitHub answered 404 Not Found.", "GitHub answered 404 Not Found."],
    ["failed", "", "Something went wrong."],
    ["surprise", "It broke.", "It broke."],
  ])("%s", (kind, detail, expected) => {
    expect(failureReason({ kind, detail })).toBe(expected);
  });
});

describe("the texts of the installation", () => {
  it("says what the block asks and does", () => {
    expect(updateLabel("0.5.0")).toBe("Update to 0.5.0");
    expect(UPDATING).toBe("Updating…");
    expect(INSTALL_FAILURE_TITLE).toBe("Couldn't update");
  });

  it("says it is updating, with the version when known", () => {
    expect(updatingText("0.5.0")).toBe("Updating to MySpec 0.5.0…");
    expect(updatingText("")).toBe("Updating MySpec…");
  });

  it("says the version is installed and asks for the restart", () => {
    expect(installedText("0.5.0")).toBe("MySpec 0.5.0 is installed");
    expect(restartText("0.5.0")).toBe("MySpec 0.5.0 is installed. Restart to use it.");
  });
});

describe("installFailureReason and installFailureRemedy", () => {
  it.each([
    ["offline", "", "No connection to GitHub.", "Check the connection and try again."],
    ["rate_limited", "", "GitHub's rate limit was reached.", "Try again later."],
    ["timeout", "", "GitHub didn't answer in time.", "Try again."],
    ["libraries", "libfoo is missing.", "libfoo is missing.", "Install them, then try again."],
    ["system", "Not supported here.", "Not supported here.", ""],
    [
      "replace",
      "denied",
      "A file of MySpec couldn't be replaced.",
      "Close MySpec and run the install command in a terminal.",
    ],
    ["failed", "Disk full.", "Disk full.", "Try again, or run the install command in a terminal."],
    ["failed", "", "Something went wrong.", "Try again, or run the install command in a terminal."],
    [
      "unheard",
      "",
      "Something went wrong.",
      "Try again, or run the install command in a terminal.",
    ],
  ])("%s with %j", (kind, reason, expectedReason, expectedRemedy) => {
    const failure = makeUpdateInstallFailure({ kind, reason });
    expect(installFailureReason(failure)).toBe(expectedReason);
    expect(installFailureRemedy(failure)).toBe(expectedRemedy);
  });
});

describe("installAnnouncement", () => {
  const idle = makeUpdate();
  const installing = makeUpdate({
    install: makeUpdateInstall({ phase: "installing", target: "0.5.0" }),
  });
  const installed = (working: { itemId: string; stage: string }[]) =>
    makeUpdate({
      install: makeUpdateInstall({ phase: "installed", version: "0.5.0", working }),
    });
  const failed = makeUpdate({
    install: makeUpdateInstall({
      phase: "failed",
      failure: makeUpdateInstallFailure({ kind: "timeout" }),
    }),
  });

  it("announces the start, even without a previous state", () => {
    expect(installAnnouncement(idle, installing)).toBe("Updating to MySpec 0.5.0…");
    expect(installAnnouncement(undefined, installing)).toBe("Updating to MySpec 0.5.0…");
    expect(installAnnouncement(failed, installing)).toBe("Updating to MySpec 0.5.0…");
  });

  it("asks for the restart when agents work", () => {
    expect(installAnnouncement(installing, installed([{ itemId: "a", stage: "prd" }]))).toBe(
      "MySpec 0.5.0 is installed. Restart to use it.",
    );
  });

  it("says it restarts when nothing works", () => {
    expect(installAnnouncement(installing, installed([]))).toBe(
      "MySpec 0.5.0 is installed. Restarting…",
    );
  });

  it("announces a failure with its reason", () => {
    expect(installAnnouncement(installing, failed)).toBe(
      "Couldn't update. GitHub didn't answer in time.",
    );
  });

  it("announces the return to idle as up to date", () => {
    expect(installAnnouncement(installing, idle)).toBe(UP_TO_DATE);
  });

  it("is null for every other change", () => {
    expect(installAnnouncement(installing, installing)).toBeNull();
    expect(installAnnouncement(idle, idle)).toBeNull();
    expect(installAnnouncement(undefined, undefined)).toBeNull();
    expect(installAnnouncement(undefined, idle)).toBeNull();
    expect(installAnnouncement(idle, installed([]))).toBeNull();
    expect(installAnnouncement(idle, failed)).toBeNull();
    expect(installAnnouncement(installed([]), idle)).toBeNull();
    expect(installAnnouncement(failed, failed)).toBeNull();
    expect(installAnnouncement(installing, undefined)).toBeNull();
    expect(
      installAnnouncement(idle, makeUpdate({ releases: [makeUpdateRelease()], latest: "0.5.0" })),
    ).toBeNull();
  });
});
