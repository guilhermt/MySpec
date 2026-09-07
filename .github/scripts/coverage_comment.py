#!/usr/bin/env python3
"""Puts a one-line test summary on the coverage comment of a pull request.

The two coverage actions render their own tables and neither takes extra text,
so the summary is added here: the Go report is handed to us as markdown and
posted whole, and the frontend report is already a comment we edit in place.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# Our own markers, so a second run replaces the summary instead of stacking one
# more copy of it on top.
NEWLINE = "\n"
START = "<!-- test-summary -->"
END = "<!-- /test-summary -->"


class Summary:
    """Summary is what one test run reported: how much ran, and how it went."""

    def __init__(self, total: int, failed: int, skipped: int, seconds: float):
        self.total = total
        self.failed = failed
        self.skipped = skipped
        self.seconds = seconds

    def block(self) -> str:
        return (
            f"{START}\n_{self.total:,} tests in {self.seconds:.1f}s"
            f" · {self.failed} failed · {self.skipped} skipped_\n{END}"
        )


def read_vitest(path: Path) -> Summary:
    """read_vitest reads the JSON report of `vitest --reporter=json`."""
    report = json.loads(path.read_text())
    started = report["startTime"]
    ended = max((run.get("endTime") or started) for run in report["testResults"])
    return Summary(
        total=report["numTotalTests"],
        failed=report["numFailedTests"],
        skipped=report["numPendingTests"] + report.get("numTodoTests", 0),
        seconds=max(ended - started, 0) / 1000,
    )


def read_junit(path: Path) -> Summary:
    """read_junit reads the JUnit XML that gotestsum writes."""
    root = ET.parse(path).getroot()
    return Summary(
        total=int(root.get("tests", 0)),
        failed=int(root.get("failures", 0)) + int(root.get("errors", 0)),
        skipped=sum(int(suite.get("skipped", 0)) for suite in root.iter("testsuite")),
        seconds=float(root.get("time", 0)),
    )


def summarize(path: Path) -> Summary:
    return read_vitest(path) if path.suffix == ".json" else read_junit(path)


def gh(*args: str, stdin: str | None = None) -> str:
    """gh calls the CLI the runner already has, and fails loudly."""
    done = subprocess.run(
        ["gh", *args], input=stdin, capture_output=True, text=True, check=False
    )
    if done.returncode != 0:
        sys.exit(f"gh {' '.join(args)}: {done.stderr.strip()}")
    return done.stdout


def find_comment(repo: str, pr: str, marker: str) -> tuple[int, str] | None:
    """find_comment is the comment carrying a marker, with its body."""
    listed = gh("api", "--paginate", "--slurp", f"repos/{repo}/issues/{pr}/comments")
    for page in json.loads(listed):
        for comment in page:
            if marker in comment["body"]:
                return comment["id"], comment["body"]
    return None


def post(repo: str, path: str, body: str, method: str) -> None:
    """post sends a body too large and too punctuated to travel as an argument."""
    gh(
        "api",
        "--method",
        method,
        f"repos/{repo}/{path}",
        "--input",
        "-",
        stdin=json.dumps({"body": body}),
    )


def without_summary(body: str) -> str:
    """without_summary is the comment as the action wrote it."""
    if START not in body or END not in body:
        return body
    head, _, rest = body.partition(START)
    tail = rest.partition(END)[2]
    return f"{head.rstrip(NEWLINE)}\n\n{tail.lstrip(NEWLINE)}"


def with_summary(body: str, summary: str) -> str:
    """
    with_summary puts the summary just under the heading, where it is read
    before the table rather than after it. The heading is an <h2> in the
    frontend report and the first line in the Go one.
    """
    plain = without_summary(body)
    heading, sep, rest = plain.partition("</h2>")
    if sep == "":
        heading, sep, rest = plain.partition("\n")
    return f"{(heading + sep).rstrip(NEWLINE)}\n\n{summary}\n\n{rest.lstrip(NEWLINE)}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, type=Path, help="vitest JSON or JUnit XML")
    parser.add_argument("--repo", required=True, help="owner/name")
    parser.add_argument("--pr", required=True, help="pull request number")
    parser.add_argument("--marker", required=True, help="HTML marker identifying the comment")
    parser.add_argument(
        "--body-file",
        type=Path,
        help="markdown to post as our own comment; without it, an existing comment is edited",
    )
    args = parser.parse_args()

    summary = summarize(args.report).block()
    found = find_comment(args.repo, args.pr, args.marker)

    if args.body_file is not None:
        body = with_summary(f"{args.body_file.read_text().rstrip()}\n\n{args.marker}", summary)
        if found is None:
            post(args.repo, f"issues/{args.pr}/comments", body, "POST")
        else:
            post(args.repo, f"issues/comments/{found[0]}", body, "PATCH")
        return

    if found is None:
        print(f"no comment carrying {args.marker}; nothing to add the summary to")
        return
    post(args.repo, f"issues/comments/{found[0]}", with_summary(found[1], summary), "PATCH")


if __name__ == "__main__":
    main()
