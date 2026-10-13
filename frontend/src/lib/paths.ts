// The webview has no environment to read the home from, so it is recognised by
// shape: on Linux every home is a direct child of /home, on Windows of C:\Users.
const HOME_PREFIX = /^\/home\/[^/]+(?=\/|$)/;
const WINDOWS_HOME_PREFIX = /^[A-Za-z]:\\Users\\[^\\]+(?=\\|$)/;

export function displayPath(path: string): string {
  return path.replace(HOME_PREFIX, "~").replace(WINDOWS_HOME_PREFIX, "~");
}

// HOME_IN_TEXT is a home directory inside a sentence: it starts a path, at the start of the text or
// after a space, a quote or a parenthesis, so a /home/x deep in another path stays; and it ends at a
// slash, a space, the end or punctuation. On Windows the home is C:\Users\x, and git writes it C:/Users/x.
const HOME_IN_TEXT =
  /(?<=^|[\s'"`(])(?:\/home\/|[A-Za-z]:[\\/]Users[\\/])[\w-]+(?:\.[\w-]+)*(?=[\\/\s.,:;)'"`]|$)/g;

/** displayPaths writes every home directory of a text as a tilde. */
export function displayPaths(text: string): string {
  return text.replace(HOME_IN_TEXT, "~");
}

/** isWindowsPath says whether a path is a Windows one: a drive letter and its separator. */
export function isWindowsPath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path);
}

/** joinPath puts a name inside a folder with the separator of the folder's system. */
export function joinPath(folder: string, name: string): string {
  const separator = isWindowsPath(folder) ? "\\" : "/";
  return `${folder}${separator}${name}`;
}
