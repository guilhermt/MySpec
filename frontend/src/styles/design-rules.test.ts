import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs with css: false, so the stylesheets are read as text.
const SRC = join(import.meta.dirname, "..");
const GLOBALS = readFileSync(join(SRC, "styles/globals.css"), "utf8");
const TOKENS = readFileSync(join(SRC, "../../design/system/tokens.css"), "utf8");

/**
 * TAILWIND_PALETTE matches a class that paints with a colour of the Tailwind palette (text-red-500,
 * bg-amber-100/50, fill-white), which reads the oklch of the Tailwind theme instead of a token.
 */
const TAILWIND_PALETTE =
  /(?:^|[\s"'`:])(?:bg|text|border(?:-[trblxyse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|shadow|inset-shadow|accent|caret|placeholder)-(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe)-\d{2,3}|black|white)(?:\/\d+)?(?=$|[\s"'`])/;

/** Files that are still read by the old design, until the step that removes them. */
// Removed in the next step, with ModelPicker and ReviewModePicker.
const PENDING_REMOVAL = [
  "features/models/ModelPicker.tsx",
  "features/review-mode/ReviewModePicker.tsx",
];

type RuleId = "V3" | "V4" | "V5" | "V6" | "V7";

interface Rule {
  id: RuleId;
  patterns: (path: string) => RegExp[];
}

/** The names the generated components read through the bridge of globals.css, which no token has. */
function bridgeNames(): string[] {
  const theme = /@theme inline \{([^}]*)\}/.exec(GLOBALS)?.[1] ?? "";
  const tokens = new Set([...TOKENS.matchAll(/(?<![\w-])--([\w-]+)\s*:/g)].map(([, name]) => name));
  return [...theme.matchAll(/--color-([\w-]+)\s*:/g)]
    .map(([, name]) => name ?? "")
    .filter((name) => !tokens.has(name))
    .sort((a, b) => b.length - a.length);
}

const NAMES = bridgeNames();

const RULES: Rule[] = [
  {
    id: "V3",
    patterns: (path) =>
      path.endsWith(".css")
        ? [/oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/]
        : [/oklch\(|rgba?\(|hsla?\(/, /["'`[]#[0-9a-fA-F]{3,8}["'`\]]/, TAILWIND_PALETTE],
  },
  {
    id: "V4",
    patterns: () => [
      new RegExp(
        `(?<![\\w-])(bg|text|border|ring|outline|fill|stroke|divide|placeholder)-(${NAMES.join("|")})(\\/\\d+)?(?![\\w-])`,
      ),
    ],
  },
  {
    id: "V5",
    patterns: () => [
      /--status-(working|attention|attention-fill|success|paused)\b/,
      /status-(working|attention|success|paused)/,
    ],
  },
  {
    id: "V6",
    patterns: () => [/(?<![\w-])text-(xs|sm|base|lg|[2-9]?xl)(?![\w-])/],
  },
  {
    id: "V7",
    patterns: () => [
      /animate-(spin|pulse|bounce|ping)/,
      /(?<![\w-])(duration|delay)-\d/,
      /(?<![\w-])ease-(in|out|in-out|linear)(?![\w-])/,
    ],
  },
];

/** The lines of globals.css that are the only place of the shadcn names: the theme block and the bridge. */
function bridgeLines(path: string, lines: string[]): Set<number> {
  const skipped = new Set<number>();
  if (path !== "styles/globals.css") {
    return skipped;
  }
  const open = [/^@theme inline \{/, /^\[data-theme\] \{/];
  let closing = false;
  lines.forEach((line, index) => {
    if (!closing && open.some((start) => start.test(line))) {
      closing = true;
    }
    if (closing) {
      skipped.add(index);
      closing = !/^\}/.test(line);
    }
  });
  return skipped;
}

/** The lines ("<path>:<n>: <excerpt>") in which the rule matches text. */
function violations(rule: Rule, path: string, text: string): string[] {
  const lines = text.split("\n");
  const skipped = rule.id === "V4" ? bridgeLines(path, lines) : new Set<number>();
  const patterns = rule.patterns(path);
  return lines.flatMap((line, index) =>
    !skipped.has(index) && patterns.some((pattern) => pattern.test(line))
      ? [`${path}:${index + 1}: ${line.trim()}`]
      : [],
  );
}

/** Every source file the rules read: the generated components, the test helpers and the tests are out. */
function scope(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
    (path) =>
      /\.(css|tsx?)$/.test(path) &&
      !path.startsWith("components/ui/") &&
      !path.startsWith("test/") &&
      !/\.test\./.test(path),
  );
}

const FILES = scope().map((path) => ({ path, text: readFileSync(join(SRC, path), "utf8") }));

function rule(id: RuleId): Rule {
  const found = RULES.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no rule ${id}`);
  }
  return found;
}

describe("design rules", () => {
  describe("each rule bites", () => {
    const cases: [RuleId, string, string, string][] = [
      ["V3", "foo.css", "color: oklch(0.5 0 0);", "color: var(--ink-3);"],
      ["V3", "foo.tsx", 'className="text-red-500"', 'className="text-ink-3"'],
      [
        "V4",
        "foo.tsx",
        '<p className="text-muted-foreground">',
        '<p className="bg-sidebar-guide">',
      ],
      ["V5", "foo.css", "color: var(--status-working);", "color: var(--state-work);"],
      ["V6", "foo.css", "@apply text-sm;", "font-size: var(--text-ui);"],
      ["V6", "foo.tsx", 'className="text-sm"', 'className="text-(length:--text-ui)"'],
      ["V7", "foo.tsx", 'className="animate-spin"', 'className="spin-glyph"'],
      ["V7", "foo.tsx", 'className="duration-200"', 'className="ease-(--ease-standard)"'],
    ];

    it.each(cases)("%s on %s: %s", (id, path, bad, good) => {
      expect(violations(rule(id), path, bad)).toHaveLength(1);
      expect(violations(rule(id), path, good)).toEqual([]);
    });

    it("V3 recognises a colour of the Tailwind palette in a class", () => {
      for (const painted of [
        "text-red-500",
        "bg-amber-100/50",
        "hover:border-slate-200",
        "fill-white",
      ]) {
        expect(TAILWIND_PALETTE.test(`className="${painted}"`), painted).toBe(true);
      }
      for (const system of ["text-ink-3", "bg-state-error-veil", "text-red-ish", "border-line-2"]) {
        expect(TAILWIND_PALETTE.test(`className="${system}"`), system).toBe(false);
      }
    });

    it("V4 leaves the theme block and the bridge of globals.css alone", () => {
      const text = "@theme inline {\n  --color-x: bg-background;\n}\n.a { bg-background }";

      expect(violations(rule("V4"), "styles/globals.css", text)).toEqual([
        "styles/globals.css:4: .a { bg-background }",
      ]);
    });
  });

  describe("on every source file", () => {
    it("reads the names of the bridge from globals.css", () => {
      expect(FILES.length).toBeGreaterThan(0);
      expect(NAMES.length).toBeGreaterThan(0);
      expect(NAMES).toContain("muted-foreground");
    });

    it.each(RULES)("$id finds nothing", (current) => {
      const found = FILES.filter(({ path }) => !PENDING_REMOVAL.includes(path)).flatMap(
        ({ path, text }) => violations(current, path, text),
      );

      expect(found).toEqual([]);
    });
  });
});
