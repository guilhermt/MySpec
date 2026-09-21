import { diffLines } from "diff";

/** DiffLine is one line of a body, and what became of it. */
export interface DiffLine {
  kind: "same" | "added" | "removed";
  text: string;
}

// A body reads by its lines: neither the carriage returns of a body typed on
// GitHub nor whether it ends in a newline is a change of a line. The Go side
// strips the carriage returns of the drafts the same way.
function whole(value: string): string {
  const text = value.replaceAll("\r", "");
  return text === "" || text.endsWith("\n") ? text : `${text}\n`;
}

// A change of jsdiff carries whole lines, each with its newline; the empty tail
// the split leaves behind is no line at all.
function linesOf(value: string): string[] {
  const lines = value.split("\n");
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

// What a change of jsdiff says of its lines.
function kindOf(change: { added?: boolean; removed?: boolean }): DiffLine["kind"] {
  if (change.added === true) {
    return "added";
  }
  return change.removed === true ? "removed" : "same";
}

/**
 * bodyDiff is what an update does to the body of a card, line by line: the
 * lines both texts share, the ones the draft adds and the ones it takes away,
 * in the order they read.
 */
export function bodyDiff(current: string, next: string): DiffLine[] {
  return diffLines(whole(current), whole(next)).flatMap((change) => {
    const kind = kindOf(change);
    return linesOf(change.value).map((text): DiffLine => ({ kind, text }));
  });
}
