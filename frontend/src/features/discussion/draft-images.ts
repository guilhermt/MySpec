/** DraftImageRef is an image of a body as the text writes it. */
export interface DraftImageRef {
  src: string;
  alt: string;
}

// An image of the text being typed: ![alt](destination "title"). It serves the row of thumbnails
// and the diff only; the Go side, with goldmark, decides what is published.
const IMAGE = /!\[((?:\\.|[^\]\\])*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;

const PASTED_NAME = "pasted image";

// unescaped is the alt text as it reads, without the backslash of an escaped character.
function unescaped(alt: string): string {
  return alt.replace(/\\(.)/g, "$1");
}

/** bodyImages are the images of a Markdown text, once per destination, in the order they first appear. */
export function bodyImages(text: string): DraftImageRef[] {
  const found = new Map<string, DraftImageRef>();
  for (const match of text.matchAll(IMAGE)) {
    const src = match[2] ?? "";
    if (!found.has(src)) {
      found.set(src, { src, alt: unescaped(match[1] ?? "") });
    }
  }
  return [...found.values()];
}

/** removeImage takes every image with that destination out of the text; a line left empty by it goes too. */
export function removeImage(text: string, src: string): string {
  return text
    .split("\n")
    .flatMap((line) => {
      const cut = line.replace(IMAGE, (whole, _alt, destination) =>
        destination === src ? "" : whole,
      );
      return cut === line || cut.trim() !== "" ? [cut] : [];
    })
    .join("\n");
}

/** readableImages writes each image of a line as "[Image: alt]", or "[Image]" without alt. */
export function readableImages(line: string): string {
  return line.replace(IMAGE, (_whole, alt: string) => {
    const text = unescaped(alt);
    return text === "" ? "[Image]" : `[Image: ${text}]`;
  });
}

/** imageReference is the Markdown of an image: ![alt](ref), with ] and \ of the alt escaped. */
export function imageReference(alt: string, ref: string): string {
  return `![${alt.replace(/[\\\]]/g, "\\$&")}](${ref})`;
}

/** altOf is the first alt text of a file: its name without the extension, "Image" for a paste without a name. */
export function altOf(name: string): string {
  if (name === PASTED_NAME || name === "") {
    return "Image";
  }
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
