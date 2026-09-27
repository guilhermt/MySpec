import {
  Archive,
  ArrowUpRight,
  Bot,
  Check,
  Code,
  Contrast,
  FileText,
  GitMerge,
  Hourglass,
  Kanban,
  Link,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import { DiscussionIcon, GoIcon, MarkIcon, OneShotIcon, ReviewIcon, TaskIcon } from "./type-icons";

/** IconGlyph is a lucide icon or one of the system's own SVG icons: both take a class and hide from the reader. */
export type IconGlyph = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

/** ICONS is the one icon of each meaning, the same across the product (components.md, Ícones). */
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
} as const satisfies Record<string, IconGlyph>;

/** IconMeaning is the name of a meaning in ICONS. */
export type IconMeaning = keyof typeof ICONS;
