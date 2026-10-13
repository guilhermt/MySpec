import { describe, expect, it } from "vitest";
import { displayPath, displayPaths, isWindowsPath, joinPath } from "@/lib/paths";

describe("displayPath", () => {
  it("replaces the home directory with a tilde", () => {
    expect(displayPath("/home/dev/projects/api")).toBe("~/projects/api");
  });

  it("replaces a bare home directory", () => {
    expect(displayPath("/home/dev")).toBe("~");
  });

  it("leaves paths outside home untouched", () => {
    expect(displayPath("/srv/code/api")).toBe("/srv/code/api");
  });

  it("does not match a directory that merely starts with home", () => {
    expect(displayPath("/homework/api")).toBe("/homework/api");
  });

  it("replaces the home directory of Windows", () => {
    expect(displayPath("C:\\Users\\dev\\code\\infra")).toBe("~\\code\\infra");
    expect(displayPath("C:\\Users\\dev")).toBe("~");
    expect(displayPath("D:\\work")).toBe("D:\\work");
  });
});

describe("displayPaths", () => {
  it.each([
    ["/home/dev/projects/api", "~/projects/api"],
    ["/home/dev", "~"],
    ["Can't open /home/dev/.myspec: permission denied", "Can't open ~/.myspec: permission denied"],
    ["in /home/dev, then /home/ana.", "in ~, then ~."],
    ["(/home/dev) '/home/dev/x' \"/home/dev\"", "(~) '~/x' \"~\""],
    ["/home/dev/a and /home/dev/b", "~/a and ~/b"],
    ["/home/ana.silva/api", "~/api"],
    ["/srv/code/api", "/srv/code/api"],
    ["/homework/api", "/homework/api"],
    ["no path here", "no path here"],
    ["`/home/dev/x` is gone", "`~/x` is gone"],
    ["/mnt/backup/home/guilherme/x", "/mnt/backup/home/guilherme/x"],
    ["/srv/home/code/api is a clone", "/srv/home/code/api is a clone"],
    ["Can't open /tmp/scratchpad/app/home/dev/web", "Can't open /tmp/scratchpad/app/home/dev/web"],
    ["/mnt/home/dev and /home/dev", "/mnt/home/dev and ~"],
    ["clone C:/Users/dev/code failed", "clone ~/code failed"],
  ])("writes %j as %j", (text, want) => {
    expect(displayPaths(text)).toBe(want);
  });
});

describe("isWindowsPath", () => {
  it.each([
    ["C:\\x", true],
    ["c:/x", true],
    ["/home/x", false],
  ])("says %j is %j", (path, want) => {
    expect(isWindowsPath(path)).toBe(want);
  });
});

describe("joinPath", () => {
  it("joins with the separator of the folder's system", () => {
    expect(joinPath("C:\\code", "api")).toBe("C:\\code\\api");
    expect(joinPath("/home/dev/code", "api")).toBe("/home/dev/code/api");
  });
});
