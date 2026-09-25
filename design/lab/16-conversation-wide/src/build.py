#!/usr/bin/env python3
"""Builds the self-contained pages of round 16 from src/.

Each page carries design/system/tokens.css verbatim between markers, then
the tokens this round proposes (proposed.css), the shell of round 10-b and
the shared conversation pieces of round 15 (copied into src/), the wide
conversation both variations share (wide.css, wide.js) and the variation.
Run from anywhere: python3 design/lab/16-conversation-wide/src/build.py
"""
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROUND = SRC.parent
TOKENS = (ROUND.parent.parent / "system" / "tokens.css").read_text()
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600'
         '&family=Fira+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">')
THEME = ('<script>(function () { const t = new URLSearchParams(location.search).get("theme"); '
         'if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; })();</script>')
SHELL_CSS = ["base.css", "core.css", "m.css", "shell.css", "conv.css", "proposed.css", "wide.css"]
SHELL_JS = ["core.js", "content.js", "m.js", "stepper.js", "shell.js", "conv-data.js", "conv-common.js", "wide.js"]


def read(name):
    return (SRC / name).read_text()


def page(out, title, desc, css, js):
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{FONTS}
{THEME}
<style id="tokens">
/* BEGIN design/system/tokens.css */
{TOKENS}/* END design/system/tokens.css */
</style>
<style id="components">
{"".join(read(c) + chr(10) for c in css)}
</style>
</head>
<body>
<script>
{"".join(read(j) + chr(10) for j in js)}
</script>
</body>
</html>
"""
    (ROUND / out).write_text(html)
    body = html.split("/* BEGIN design/system/tokens.css */\n", 1)[1].split("/* END design/system/tokens.css */", 1)[0]
    assert body == TOKENS, f"{out}: the tokens block differs from design/system/tokens.css"
    print(f"wrote {out} ({len(html) // 1024} KB)")


page("a.html", "Conversation · wide column",
     "The conversation in a fixed wide column: raised cards, the author as a word, commands as blocks with folded output.",
     SHELL_CSS + ["a.css"], SHELL_JS + ["a.js"])
page("b.html", "Conversation · fluid",
     "The conversation follows the main area with proportional margins: flat cards, your message indented, commands as rows.",
     SHELL_CSS + ["b.css"], SHELL_JS + ["b.js"])
if (SRC / "components.js").exists():
    page("components.html", "Wide conversation components",
         "Every piece of the two variations in every state, light and dark side by side.",
         SHELL_CSS + ["a.css", "b.css", "components.css"],
         [j for j in SHELL_JS if j != "m.js"] + ["components.js"])
