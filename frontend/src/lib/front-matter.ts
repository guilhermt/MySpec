/** FrontMatter is a step file split into its metadata header and its text. */
export interface FrontMatter {
  fields: Record<string, string>;
  body: string;
}

// The header of a step file opens and closes with this line, as in the skills.
const FENCE = "---";

const QUOTES = ['"', "'", "`"];

// A value may be wrapped in quotes or backticks, which are not part of it.
function unwrap(value: string): string {
  for (const quote of QUOTES) {
    if (value.length >= 2 && value.startsWith(quote) && value.endsWith(quote)) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * splitFrontMatter cuts the metadata header off content, with the same rules
 * as the Go side. Content without a header is all body.
 */
export function splitFrontMatter(content: string): FrontMatter {
  const text = content.replaceAll("\r", "");
  if (!text.startsWith(`${FENCE}\n`)) {
    return { fields: {}, body: content };
  }

  const lines = text.slice(FENCE.length + 1).split("\n");
  const end = lines.indexOf(FENCE);
  if (end < 0) {
    return { fields: {}, body: content };
  }

  const fields: Record<string, string> = {};
  for (const line of lines.slice(0, end)) {
    const colon = line.indexOf(":");
    if (colon < 0) {
      continue;
    }
    fields[line.slice(0, colon).trim()] = unwrap(line.slice(colon + 1).trim());
  }
  return { fields, body: lines.slice(end + 1).join("\n") };
}
