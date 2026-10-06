import { describe, expect, it } from "vitest";
import { codeMarkdown, codeParts, fencedLines } from "@/features/chat/code-cut";

const lines = (count: number) => Array.from({ length: count }, (_, at) => `line ${at + 1}`);

describe("codeParts", () => {
  it("keeps text as it was written", () => {
    const markdown = ["Some text", "", "More"].join("\n");

    expect(codeParts(markdown)).toEqual([{ kind: "text", text: markdown }]);
  });

  it("splits out every code block, short or long", () => {
    const markdown = ["Some text", "```go", ...lines(2), "```", "More"].join("\n");

    expect(codeParts(markdown)).toEqual([
      { kind: "text", text: "Some text" },
      { kind: "code", fence: "```", info: "go", lines: lines(2), closed: true },
      { kind: "text", text: "More" },
    ]);
  });

  it("splits out a code block of more than 24 lines", () => {
    const markdown = ["Before", "```go", ...lines(46), "```", "After"].join("\n");

    expect(codeParts(markdown)).toEqual([
      { kind: "text", text: "Before" },
      { kind: "code", fence: "```", info: "go", lines: lines(46), closed: true },
      { kind: "text", text: "After" },
    ]);
  });

  it("splits out a block still streaming, without its closing fence", () => {
    const markdown = ["~~~~", ...lines(25)].join("\n");

    expect(codeParts(markdown)).toEqual([
      { kind: "code", fence: "~~~~", info: "", lines: lines(25), closed: false },
    ]);
  });

  it("closes a block only with a fence as long, of the same mark", () => {
    const markdown = ["````", ...lines(12), "```", "~~~", ...lines(12), "````"].join("\n");

    expect(codeParts(markdown)).toEqual([
      {
        kind: "code",
        fence: "````",
        info: "",
        lines: [...lines(12), "```", "~~~", ...lines(12)],
        closed: true,
      },
    ]);
  });
});

describe("codeMarkdown", () => {
  it("writes the block with the lines it shows, closed", () => {
    const part = {
      kind: "code",
      fence: "```",
      info: "go",
      lines: lines(30),
      closed: false,
    } as const;

    expect(codeMarkdown(part, 2)).toBe("```go\nline 1\nline 2\n```");
  });
});

describe("codeParts nested fences", () => {
  it("keeps an item going through a lazy line of its text, with the fence indented inside it", () => {
    const markdown = ["- item", "continued", "  ```js", "  x", "  ```"].join("\n");

    expect(codeParts(markdown)).toEqual([{ kind: "text", text: markdown }]);
  });

  it("leaves a fence inside a list item in the text, so the list stays whole", () => {
    const markdown = "1. Run:\n   ```bash\n   ls -la\n   ```\n2. Then";

    expect(codeParts(markdown)).toEqual([{ kind: "text", text: markdown }]);
  });

  it("splits a fence at the margin after a list, and one that follows an item's fence", () => {
    const markdown = ["- a", "  ```", "  - not an item", "  ```", "", "```go", "x", "```"].join(
      "\n",
    );

    expect(codeParts(markdown)).toEqual([
      { kind: "text", text: ["- a", "  ```", "  - not an item", "  ```", ""].join("\n") },
      { kind: "code", fence: "```", info: "go", lines: ["x"], closed: true },
    ]);
  });

  it("takes a fence opened on the line of the item as the item's, up to its close", () => {
    const markdown = ["- ```js", "  code", "  ```", "", "```go", "x", "```"].join("\n");

    expect(codeParts(markdown)).toEqual([
      { kind: "text", text: ["- ```js", "  code", "  ```", ""].join("\n") },
      { kind: "code", fence: "```", info: "go", lines: ["x"], closed: true },
    ]);
  });

  it("leaves a fence inside a blockquote and one indented four spaces in the text", () => {
    const markdown = ["> ```", "> quoted", "> ```", "", "    ```", "    indented", "    ```"].join(
      "\n",
    );

    expect(codeParts(markdown)).toEqual([{ kind: "text", text: markdown }]);
  });

  it.each([
    [
      "a nested item whose fence never closes",
      ["- a", "  - ```js", "    x", "    ```", "", "```go", "y", "```"],
      ["- a", "  - ```js", "    x", "    ```", ""],
    ],
    [
      "an ordered item with a wide marker",
      ["10. ```js", "    x", "    ```", "", "```go", "y", "```"],
      ["10. ```js", "    x", "    ```", ""],
    ],
    [
      "an item fence left open, which the margin ends",
      ["- ```js", "  x", "", "```go", "y", "```"],
      ["- ```js", "  x", ""],
    ],
  ])("splits a fence at the margin after %s", (_, markdown, want) => {
    expect(codeParts(markdown.join("\n"))).toEqual([
      { kind: "text", text: want.join("\n") },
      { kind: "code", fence: "```", info: "go", lines: ["y"], closed: true },
    ]);
  });

  it("splits a fence indented less than the text column of the item", () => {
    expect(codeParts(["1. a", "", "  ```go", "  y", "  ```"].join("\n"))).toEqual([
      { kind: "text", text: "1. a\n" },
      { kind: "code", fence: "```", info: "go", lines: ["y"], closed: true },
    ]);
  });

  it("takes the indent of a fence off its lines", () => {
    expect(codeParts("  ```\n  a\n    b\n  ```")).toEqual([
      { kind: "code", fence: "```", info: "", lines: ["a", "  b"], closed: true },
    ]);
  });
});

describe("fencedLines", () => {
  it.each([
    [
      "a block and its fences",
      ["Text", "```go", "x := 1", "```", "After"],
      [false, true, true, true, false],
    ],
    [
      "a fence with an info, which never closes a block",
      ["```", "```go", "code", "```", "After"],
      [true, true, true, true, false],
    ],
    [
      "a shorter fence, which doesn't close a longer one",
      ["````", "```", "````"],
      [true, true, true],
    ],
    [
      "a tilde fence, closed only by tildes",
      ["~~~", "```", "~~~", "Text"],
      [true, true, true, false],
    ],
    [
      "backticks in the info of a backtick fence, which open nothing",
      ["``` a`b", "Text"],
      [false, false],
    ],
    ["a block that never closes", ["```", "code"], [true, true]],
  ])("marks %s", (_, markdown, want) => {
    expect(fencedLines(markdown)).toEqual(want);
  });
});
