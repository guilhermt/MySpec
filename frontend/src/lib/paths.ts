// The webview has no environment to read $HOME from, so home is recognised by
// shape: on the target platform every home is a direct child of /home.
const HOME_PREFIX = /^\/home\/[^/]+(?=\/|$)/;

export function displayPath(path: string): string {
  return path.replace(HOME_PREFIX, "~");
}

// HOME_IN_TEXT is a home directory inside a sentence: it starts a path, at the start of the text or
// after a space, a quote or a parenthesis, so a /home/x deep in another path stays; and it ends at a
// slash, a space, the end or punctuation.
const HOME_IN_TEXT = /(?<=^|[\s'"`(])\/home\/[\w-]+(?:\.[\w-]+)*(?=[/\s.,:;)'"`]|$)/g;

/** displayPaths writes every home directory of a text as a tilde. */
export function displayPaths(text: string): string {
  return text.replace(HOME_IN_TEXT, "~");
}
