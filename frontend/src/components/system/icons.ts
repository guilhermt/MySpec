import {
  Archive,
  ArrowDown,
  ArrowUpRight,
  Ban,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Code,
  Contrast,
  Ellipsis,
  FileText,
  Flag,
  FoldVertical,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  History,
  Hourglass,
  Info,
  Kanban,
  Link,
  ListChecks,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  RotateCw,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { CardIcon } from "./CardIcon";
import { DiscussionIcon, GoIcon, MarkIcon, OneShotIcon, ReviewIcon, TaskIcon } from "./type-icons";

/** IconGlyph is a lucide icon or one of the system's own SVG icons: both take a class and hide from the reader. */
export type IconGlyph = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

/**
 * ICONS is the one icon of each meaning, the same across the product (components.md, Ícones). A
 * meaning that shares a drawing reuses the key: the product's message is `mark`, the action that
 * waits for a permission is `waiting`, and the ✕ of a failed command is `close`.
 */
export const ICONS = {
  agentMode: Bot,
  manualMode: User,
  openInEditor: Code,
  external: ArrowUpRight,
  revised: Pencil,
  chain: Link,
  waiting: Hourglass,
  done: Check,
  task: TaskIcon,
  oneShot: OneShotIcon,
  review: ReviewIcon,
  discussion: DiscussionIcon,
  go: GoIcon,
  mark: MarkIcon,
  board: Kanban,
  file: FileText,
  archive: Archive,
  merge: GitMerge,
  trash: Trash2,
  theme: Contrast,
  details: Info,
  card: CardIcon,
  conversation: MessageSquare,
  history: History,
  more: Ellipsis,
  pause: Pause,
  resume: Play,
  start: Flag,
  commit: GitCommitHorizontal,
  pullRequest: GitPullRequest,
  checks: ListChecks,
  compact: FoldVertical,
  retry: RotateCw,
  problem: CircleAlert,
  ban: Ban,
  subagent: GitBranch,
  close: X,
  toEnd: ArrowDown,
  chevron: ChevronRight,
} as const satisfies Record<string, IconGlyph>;

/** IconMeaning is the name of a meaning in ICONS. */
export type IconMeaning = keyof typeof ICONS;
