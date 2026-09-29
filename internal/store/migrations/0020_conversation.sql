-- The whole output of a tool call, read on demand: the stdout and the stderr
-- of Bash, the text of a failed tool, the report of a subagent. ANSI escapes
-- stripped, at most the last 64 KiB. A migration that recreates
-- transcript_entries must recreate this table too.
CREATE TABLE action_outputs (
    entry_id  TEXT PRIMARY KEY REFERENCES transcript_entries (id) ON DELETE CASCADE,
    text      TEXT NOT NULL,
    lines     INTEGER NOT NULL,
    truncated INTEGER NOT NULL
) STRICT;

-- Who merged the pull request and when, as gh reads them: '' before the merge
-- and for a merge read before these columns.
ALTER TABLE pr_runs ADD COLUMN merged_by TEXT NOT NULL DEFAULT '';
ALTER TABLE pr_runs ADD COLUMN merged_at TEXT NOT NULL DEFAULT '';
