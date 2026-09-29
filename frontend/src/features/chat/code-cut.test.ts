import { describe, expect, it } from "vitest";
import { codeMarkdown, cutParts } from "@/features/chat/code-cut";

const lines = (count: number) => Array.from({ length: count }, (_, at) => `line ${at + 1}`);

describe("cutParts", () => {
  it("keeps text and short code blocks as text", () => {
    const markdown = ["Some text", "```go", ...lines(24), "```", "More"].join("\n");

    expect(cutParts(markdown)).toEqual([{ kind: "text", text: markdown }]);
  });

  it("splits out a code block of more than 24 lines", () => {
    const markdown = ["Before", "```go", ...lines(46), "```", "After"].join("\n");

    expect(cutParts(markdown)).toEqual([
      { kind: "text", text: "Before" },
      { kind: "code", fence: "```", info: "go", lines: lines(46), closed: true },
      { kind: "text", text: "After" },
    ]);
  });

  it("cuts a block still streaming, without its closing fence", () => {
    const markdown = ["~~~~", ...lines(25)].join("\n");

    expect(cutParts(markdown)).toEqual([
      { kind: "code", fence: "~~~~", info: "", lines: lines(25), closed: false },
    ]);
  });

  it("closes a block only with a fence as long, of the same mark", () => {
    const markdown = ["````", ...lines(12), "```", "~~~", ...lines(12), "````"].join("\n");

    expect(cutParts(markdown)).toEqual([
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
