#!/usr/bin/env python3
"""Builds the self-contained pages of round 09 from src/.

Each page carries design/system/tokens.css verbatim between markers, then the
components of round 08 (base.css), the shared pieces (core.css) and its own.
Run from anywhere: python3 design/lab/09-screen-task/src/build.py
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
{read("base.css")}
{read("core.css")}
{"".join(read(c) for c in css)}
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
    # The tokens block must be the file, byte for byte.
    body = html.split("/* BEGIN design/system/tokens.css */\n", 1)[1].split("/* END design/system/tokens.css */", 1)[0]
    assert body == TOKENS, f"{out}: the tokens block differs from design/system/tokens.css"
    print(f"wrote {out} ({len(html) // 1024} KB)")


page("a.html", "09 · A · Conversation with milestones",
     "The task Rate limit per API key as one conversation with the workflow's milestones.",
     ["a.css"], ["core.js", "content.js", "a.js"])
if (SRC / "b.js").exists():
    page("b.html", "09 · B · Workflow with conversations",
         "The task Rate limit per API key organized by its workflow, one conversation at a time.",
         ["b.css"], ["core.js", "content.js", "b.js"])
if (SRC / "components.js").exists():
    page("components.html", "09 · New components",
         "The components the task screen asks for, in every state and both modes.",
         ["a.css", "b.css", "components.css"], ["core.js", "content.js", "components.js"])
