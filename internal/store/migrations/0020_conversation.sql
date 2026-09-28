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
