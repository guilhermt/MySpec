/** CUT_ABOVE is the most lines a code block shows whole. */
export const CUT_ABOVE = 24;

/** CUT_SHOWN is the lines a longer code block shows until it is opened. */
export const CUT_SHOWN = 20;

/**
 * MarkdownPart is a piece of Markdown drawn on its own: text, or a fenced code block. fence is the
 * opening fence ("```", "~~~~") and info what follows it; closed is false while the block still
 * streams.
 */
export type MarkdownPart =
  | { kind: "text"; text: string }
  | { kind: "code"; fence: string; info: string; lines: string[]; closed: boolean };

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/;
const LIST_MARKER = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s+/;

// openingOf is the fence a line opens a code block with and the info after it, null for a line
// that opens none: a backtick fence has no backtick in its info.
function openingOf(line: string): { fence: string; info: string; indent: number } | null {
  const match = FENCE.exec(line);
  const fence = match?.[2];
  const info = match?.[3] ?? "";
  if (fence === undefined || (fence[0] === "`" && info.includes("`"))) {
    return null;
  }
  return { fence, info, indent: match?.[1]?.length ?? 0 };
}

// closes reports whether a line closes the block the fence opened: a fence of the same mark, as
// long at least, with nothing after it.
function closes(line: string, fence: string): boolean {
  const match = FENCE.exec(line);
  const run = match?.[2] ?? "";
  return run[0] === fence[0] && run.length >= fence.length && (match?.[3] ?? "").trim() === "";
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
 * codeParts splits Markdown around its fenced code blocks, which the CodeBlock draws, cut when it
 * has more than CUT_ABOVE lines; everything else stays text, as written. A block without its
 * closing fence is one still streaming. A fence inside a list item is part of the item, and so is
 * one in a blockquote or indented four spaces or more: they stay in the text for Streamdown, which
 * keeps the list whole.
 */
export function codeParts(markdown: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  const text: string[] = [];
  const flush = () => {
    if (text.length > 0) {
      parts.push({ kind: "text", text: text.join("\n") });
      text.length = 0;
    }
  };
  const lines = markdown.split("\n");
  // columns are the text columns of the list items the line sits in, outermost first: a line
  // indented less than the innermost ends that item.
  const columns: number[] = [];
  // paragraph is whether the line before is text of an item, which a line of plain text below it
  // continues however it is indented (a lazy line) instead of ending the item.
  let paragraph = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const indent = line.length - line.trimStart().length;
    const item = LIST_ITEM.test(line);
    const lazy = paragraph && !item && openingOf(line) === null;
    paragraph = false;
    if (line.trim() !== "" && !lazy) {
      while (columns.length > 0 && indent < (columns[columns.length - 1] ?? 0)) {
        columns.pop();
      }
      if (item) {
        columns.push(LIST_MARKER.exec(line)?.[0].length ?? line.length + 1);
      }
    }
    const open = openingOf(line);
    if (columns.length > 0) {
      // The fence is the item's own when it opens on the line of the item's marker or inside it.
      const owned = item ? openingOf(line.replace(LIST_MARKER, "")) : open;
      text.push(line);
      paragraph = owned === null && line.trim() !== "";
      if (owned !== null) {
        // Its lines, up to the closing fence, are the item's; the item's column is off each of them.
        const column = columns[columns.length - 1] ?? 0;
        let end = index + 1;
        while (end < lines.length) {
          const row = lines[end] ?? "";
          const rowIndent = row.length - row.trimStart().length;
          if (row.trim() !== "" && rowIndent < column) {
            break;
          }
          text.push(row);
          end += 1;
          if (closes(row.slice(Math.min(column, rowIndent)), owned.fence)) {
            break;
          }
        }
        index = end - 1;
      }
      continue;
    }
    if (open === null) {
      text.push(line);
      continue;
    }
    const { fence } = open;
    let end = index + 1;
    while (end < lines.length && !closes(lines[end] ?? "", fence)) {
      end += 1;
    }
    const body = lines
      .slice(index + 1, end)
      .map((row) => row.slice(Math.min(open.indent, row.length - row.trimStart().length)));
    const closed = end < lines.length;
    flush();
    parts.push({ kind: "code", fence, info: open.info.trim(), lines: body, closed });
    index = end;
  }
  flush();
  return parts;
}

/** codeMarkdown is the Markdown of a cut block with the lines it shows, closed. */
export function codeMarkdown(part: Extract<MarkdownPart, { kind: "code" }>, shown: number): string {
  return [`${part.fence}${part.info}`, ...part.lines.slice(0, shown), part.fence].join("\n");
}
