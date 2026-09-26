import type { ThemeRegistrationAny } from "streamdown";

/**
 * The TextMate scopes painted with each hue of the system's code tokens. No scope gets a fontStyle:
 * the code is all in the regular weight, and only the hue tells the kinds of token apart.
 */
const SCOPES = {
  "var(--code-comment)": ["comment", "punctuation.definition.comment"],
  "var(--code-keyword)": [
    "keyword",
    "storage",
    "storage.type",
    "storage.modifier",
    "variable.language",
    "entity.name.tag",
  ],
  "var(--code-string)": [
    "string",
    "string.quoted",
    "string.template",
    "string.regexp",
    "constant.character.escape",
  ],
  "var(--code-function)": [
    "entity.name.function",
    "support.function",
    "meta.function-call entity.name.function",
    "entity.other.attribute-name",
  ],
  "var(--code-number)": ["constant.numeric", "constant.language"],
} as const;

function codeTheme(name: string, type: "light" | "dark"): ThemeRegistrationAny {
  return {
    name,
    type,
    colors: { "editor.background": "var(--surface-0)", "editor.foreground": "var(--ink-1)" },
    fg: "var(--ink-1)",
    bg: "var(--surface-0)",
    tokenColors: Object.entries(SCOPES).map(([foreground, scope]) => ({
      scope: [...scope],
      settings: { foreground },
    })),
  };
}

/**
 * CODE_THEMES is the pair the code blocks are highlighted with. Every colour is
 * a variable of the design system, so the pair reads the tokens of the theme in
 * use and no literal colour lives outside tokens.css.
 */
export const CODE_THEMES = [
  codeTheme("myspec-light", "light"),
  codeTheme("myspec-dark", "dark"),
] as const;
