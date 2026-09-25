#!/usr/bin/env python3
"""Builds the self-contained pages of round 15 from src/.

Each page carries design/system/tokens.css verbatim between markers, then the
shell of round 10-b (base.css, core.css, m.css, shell.css and their scripts,
copied into src/ with the scene switch patched), the pieces the three
treatments share (conv.css, conv-data.js, conv-common.js) and the treatment.
Run from anywhere: python3 design/lab/15-conversation/src/build.py
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
SHELL_CSS = ["base.css", "core.css", "m.css", "shell.css", "conv.css"]
SHELL_JS = ["core.js", "content.js", "m.js", "stepper.js", "shell.js", "conv-data.js", "conv-common.js"]


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


VARIATIONS = [
    ("a.html", "Conversation · document", "The conversation as running text: a margin for who and when, actions as a thin folded line, milestones as rules.", "doc"),
    ("b.html", "Conversation · timeline", "The conversation on a thread: a glyph per entry, actions as nodes that open, the time on the thread.", "timeline"),
    ("c.html", "Conversation · light cards", "The conversation in light cards: each speech on a subtle surface, actions and milestones between them.", "cards"),
]
for out, title, desc, v in VARIATIONS:
    if (SRC / f"{v}.js").exists():
        page(out, title, desc, SHELL_CSS + [f"{v}.css"], SHELL_JS + [f"{v}.js"])
if (SRC / "components.js").exists():
    page("components.html", "Conversation components",
         "The entries of the three treatments, in every state and both modes.",
         SHELL_CSS + ["doc.css", "timeline.css", "cards.css", "components.css"],
         [j for j in SHELL_JS if j != "m.js"] + ["doc.js", "timeline.js", "cards.js", "components.js"])
