import {
  ArrowUpRight,
  Bot,
  Check,
  Code,
  Hourglass,
  Link,
  type LucideIcon,
  Pencil,
  User,
} from "lucide-react";

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
} as const satisfies Record<string, LucideIcon>;

/** IconMeaning is the name of a meaning in ICONS. */
export type IconMeaning = keyof typeof ICONS;
