import type { NoticeReason } from "@/lib/wails";

/**
 * NoticeMessage keeps the path apart from the prose so the banner can render it
 * in the monospace face without this module reaching for JSX.
 */
export interface NoticeMessage {
  before: string;
  path: string;
  after: string;
}

export function noticeMessage(path: string, reason: NoticeReason): NoticeMessage {
  switch (reason) {
    case "not_found":
      return { before: "", path, after: " doesn't exist." };
    case "not_directory":
      return { before: "", path, after: " isn't a folder." };
    case "not_readable":
      return { before: "", path, after: " can't be read." };
    case "last_recent_missing":
      return { before: "Your last workspace, ", path, after: ", is no longer on disk." };
  }
}
