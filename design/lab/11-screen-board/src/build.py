#!/usr/bin/env python3
"""Builds the self-contained pages of round 11 from src/.

Each page carries design/system/tokens.css verbatim between markers, then the
components of round 08 and the shell of round 10, read unchanged from
../10-screen-task-minimal/src (base.css, core.css, core.js: the sidebar tree,
the buttons, the menus, the dialog, the tooltips and the audit), and this
round's own files. Run from anywhere: python3 design/lab/11-screen-board/src/build.py
"""
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROUND = SRC.parent
SHELL = ROUND.parent / "10-screen-task-minimal" / "src"
TOKENS = (ROUND.parent.parent / "system" / "tokens.css").read_text()
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600'
         '&family=Fira+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">')
THEME = ('<script>(function () { const t = new URLSearchParams(location.search).get("theme"); '
         'if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; })();</script>')


def read(name):
    return (SHELL / name).read_text() if name in ("base.css", "core.css", "core.js") else (SRC / name).read_text()


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


BASE_CSS = ["base.css", "core.css", "board.css"]
BASE_JS = ["core.js", "data.js", "shell.js"]
page("a.html", "Board by status",
     "Home, the board Platform Roadmap grouped by status with the card in a side panel, and the creation of a task.",
     BASE_CSS + ["a.css"], BASE_JS + ["a.js"])
page("b.html", "Board by epic",
     "Home, the board Platform Roadmap grouped by epic with the card opening in place, and the creation of a task.",
     BASE_CSS + ["b.css"], BASE_JS + ["b.js"])
if (SRC / "components.js").exists():
    page("components.html", "Board components",
         "The components this round adds, in every state and in both modes.",
         BASE_CSS + ["a.css", "b.css", "components.css"], ["core.js", "data.js", "shell.js", "b.js", "components.js"])
