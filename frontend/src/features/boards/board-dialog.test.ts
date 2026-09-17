import { describe, expect, it } from "vitest";
import {
  choicesOf,
  chosenCloneOf,
  linkText,
  pluralize,
  withOption,
} from "@/features/boards/board-dialog";
import { makeBoardRepositoryOption } from "@/test/wails-mock";

describe("pluralize", () => {
  it("names one thing in the singular and any other count in the plural", () => {
    expect(pluralize(1, "card")).toBe("1 card");
    expect(pluralize(0, "card")).toBe("0 cards");
    expect(pluralize(3, "repository", "repositories")).toBe("3 repositories");
  });
});

describe("linkText", () => {
  it("says how each repository ties to the app", () => {
    expect(linkText(makeBoardRepositoryOption())).toBe("Registered · /home/dev/projects/web");
    expect(linkText(makeBoardRepositoryOption({ path: "" }))).toBe("Registered · Not cloned");
    expect(
      linkText(
        makeBoardRepositoryOption({
          link: "clone",
          path: "/home/dev/api",
          clones: ["/home/dev/api"],
        }),
      ),
    ).toBe("Clone found · /home/dev/api");
    expect(
      linkText(
        makeBoardRepositoryOption({ link: "clone", clones: ["/home/dev/a", "/home/dev/b"] }),
      ),
    ).toBe("Clone found");
    expect(linkText(makeBoardRepositoryOption({ link: "uncloned", path: "" }))).toBe(
      "Registered without a clone",
    );
    expect(
      linkText(makeBoardRepositoryOption({ link: "other_board", otherBoard: "Billing" })),
    ).toBe("dev/web belongs to the board Billing.");
  });
});

describe("chosenCloneOf", () => {
  it("takes the clone the user picked, then the path found, then the first clone", () => {
    const option = makeBoardRepositoryOption({
      link: "clone",
      path: "/home/dev/a",
      clones: ["/home/dev/a", "/home/dev/b"],
    });

    expect(chosenCloneOf(option, { "dev/web": "/home/dev/b" })).toBe("/home/dev/b");
    expect(chosenCloneOf(option, {})).toBe("/home/dev/a");
    expect(chosenCloneOf({ ...option, path: "" }, {})).toBe("/home/dev/a");
  });
});

describe("choicesOf", () => {
  it("sends the checked repositories a board can take, with the clone only for a found one", () => {
    const options = [
      makeBoardRepositoryOption(),
      makeBoardRepositoryOption({
        name: "api",
        fullName: "dev/api",
        link: "clone",
        path: "/home/dev/api",
        clones: ["/home/dev/api", "/work/api"],
      }),
      makeBoardRepositoryOption({ name: "docs", fullName: "dev/docs", checked: false }),
      makeBoardRepositoryOption({ name: "ops", fullName: "dev/ops", link: "other_board" }),
    ];

    expect(choicesOf(options, { "dev/api": "/work/api" })).toEqual([
      { owner: "dev", name: "web", path: "" },
      { owner: "dev", name: "api", path: "/work/api" },
    ]);
  });
});

describe("withOption", () => {
  it("appends a new repository and replaces one of the same name, ignoring case", () => {
    const web = makeBoardRepositoryOption();
    const api = makeBoardRepositoryOption({ name: "api", fullName: "dev/api" });

    expect(withOption([web], api)).toEqual([web, api]);

    const replaced = makeBoardRepositoryOption({ fullName: "Dev/Web", cards: 0 });
    expect(withOption([web, api], replaced)).toEqual([replaced, api]);
  });
});
