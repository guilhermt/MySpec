// The webview has no environment to read $HOME from, so home is recognised by
// shape: on the target platform every home is a direct child of /home.
const HOME_PREFIX = /^\/home\/[^/]+(?=\/|$)/;

export function displayPath(path: string): string {
  return path.replace(HOME_PREFIX, "~");
}
