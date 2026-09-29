/** CUT_ABOVE is the most lines a code block of the conversation shows whole. */
export const CUT_ABOVE = 24;

/** CUT_SHOWN is the lines a longer code block shows until it is opened. */
export const CUT_SHOWN = 20;

/**
 * MarkdownPart is a piece of Markdown drawn on its own: text, or a code block long enough to be
 * cut. fence is the opening fence ("```", "~~~~") and info what follows it; closed is false while
 * the block still streams.
 */
export type MarkdownPart =
  | { kind: "text"; text: string }
  | { kind: "code"; fence: string; info: string; lines: string[]; closed: boolean };

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

// openingOf is the fence a line opens a code block with and the info after it, null for a line
// that opens none: a backtick fence has no backtick in its info.
function openingOf(line: string): { fence: string; info: string } | null {
  const match = FENCE.exec(line);
  const fence = match?.[1];
  const info = match?.[2] ?? "";
  if (fence === undefined || (fence[0] === "`" && info.includes("`"))) {
    return null;
  }
  return { fence, info };
}

// closes reports whether a line closes the block the fence opened: a fence of the same mark, as
// long at least, with nothing after it.
function closes(line: string, fence: string): boolean {
  const match = FENCE.exec(line);
  const run = match?.[1] ?? "";
  return run[0] === fence[0] && run.length >= fence.length && (match?.[2] ?? "").trim() === "";
}

/** fencedLines marks the lines of the fenced code blocks of Markdown split in lines, their fences included. */
export function fencedLines(lines: readonly string[]): boolean[] {
  let fence: string | null = null;
  return lines.map((line) => {
    if (fence !== null) {
      if (closes(line, fence)) {
        fence = null;
      }
      return true;
    }
    fence = openingOf(line)?.fence ?? null;
    return fence !== null;
  });
}

/**
 * cutParts splits Markdown around its code blocks of more than CUT_ABOVE lines, which the
 * conversation cuts; everything else stays text, as written. A block without its closing fence is
 * one still streaming, and is cut too.
 */
export function cutParts(markdown: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  const text: string[] = [];
  const flush = () => {
    if (text.length > 0) {
      parts.push({ kind: "text", text: text.join("\n") });
      text.length = 0;
    }
  };
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const open = openingOf(line);
    if (open === null) {
      text.push(line);
      continue;
    }
    const { fence } = open;
    let end = index + 1;
    while (end < lines.length && !closes(lines[end] ?? "", fence)) {
      end += 1;
    }
    const body = lines.slice(index + 1, end);
    const closed = end < lines.length;
    if (body.length <= CUT_ABOVE) {
      text.push(...lines.slice(index, end + 1));
    } else {
      flush();
      parts.push({ kind: "code", fence, info: open.info.trim(), lines: body, closed });
    }
    index = end;
  }
  flush();
  return parts;
}

/** codeMarkdown is the Markdown of a cut block with the lines it shows, closed. */
export function codeMarkdown(part: Extract<MarkdownPart, { kind: "code" }>, shown: number): string {
  return [`${part.fence}${part.info}`, ...part.lines.slice(0, shown), part.fence].join("\n");
}
