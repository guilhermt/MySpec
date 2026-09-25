#!/usr/bin/env python3
"""Builds the self-contained pages of round 13 from src/.

Each page carries design/system/tokens.css verbatim between markers, then,
read unchanged: the components of round 08 and the shell of round 09
(base.css, core.css, core.js), the decided task screen of round 10 (m.css,
and b.css for the header's pill), the decided board of round 11 (board.css:
the row, the dialog's fields), the decided review of round 12 (review.css:
the page of an item that left, the notes, the dialogs' place; vb.css: the
publication dialog's options and the checkbox), and this round's own files.
Run from anywhere: python3 design/lab/13-screen-discussion/src/build.py
"""
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROUND = SRC.parent
R10 = ROUND.parent / "10-screen-task-minimal" / "src"
R11 = ROUND.parent / "11-screen-board" / "src"
R12 = ROUND.parent / "12-screen-review" / "src"
TOKENS = (ROUND.parent.parent / "system" / "tokens.css").read_text()
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600'
         '&family=Fira+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">')
THEME = ('<script>(function () { const t = new URLSearchParams(location.search).get("theme"); '
         'if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; })();</script>')
FROM = {"base.css": R10, "core.css": R10, "core.js": R10, "m.css": R10, "b.css": R10, "board.css": R11,
        "review.css": R12, "vb.css": R12}


def read(name):
    return (FROM.get(name, SRC) / name).read_text()


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


BASE_CSS = ["base.css", "core.css", "m.css", "b.css", "board.css", "review.css", "vb.css", "disc.css"]
BASE_JS = ["core.js", "disc.js", "pub.js"]
page("a.html", "Discussion · every draft open",
     "The discussion Usage-based pricing tiers: approving a draft publishes it at once, and every draft of the round is open with its whole body.",
     BASE_CSS, BASE_JS + ["open.js"])
page("b.html", "Discussion · one draft at a time",
     "The discussion Usage-based pricing tiers: approving a draft publishes it at once, and the drafts are a list where one opens at a time with its whole body.",
     BASE_CSS + ["focus.css"], BASE_JS + ["focus.js"])
if (SRC / "components.js").exists():
    page("components.html", "Discussion components",
         "The components this round adds, in every state, light and dark side by side.",
         BASE_CSS + ["focus.css", "components.css"], BASE_JS + ["open.js", "components.js"])
