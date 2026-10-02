-- The passes of the review of the pull request of a task that the app asked
-- for with the structured format, one row each; a pass without a row was asked
-- before the format and is decided in the conversation.
CREATE TABLE pr_passes (
    task_id          TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    pass             INTEGER NOT NULL,
    asked_at         TEXT NOT NULL,
    recorded         INTEGER NOT NULL DEFAULT 0, -- 1 once a readable report was recorded
    clean            INTEGER NOT NULL DEFAULT 0,
    summary_original TEXT NOT NULL DEFAULT '',   -- as the report has it
    revision         INTEGER NOT NULL DEFAULT 0, -- bumped every time the report is read again and differs
    recorded_at      TEXT NOT NULL DEFAULT '',   -- the first readable report, RFC 3339
    sent_at          TEXT NOT NULL DEFAULT '',   -- Apply approved, RFC 3339; '' before
    PRIMARY KEY (task_id, pass)
) STRICT;

-- The findings of each of those passes, by the number the report gives them.
CREATE TABLE pr_findings (
    task_id  TEXT NOT NULL,
    pass     INTEGER NOT NULL,
    number   INTEGER NOT NULL,          -- as the report numbers it
    title    TEXT NOT NULL DEFAULT '',  -- '' when the report gives none
    path     TEXT NOT NULL DEFAULT '',  -- '' for a general finding
    line     INTEGER NOT NULL DEFAULT 0,
    original TEXT NOT NULL,             -- as the report has it
    text     TEXT NOT NULL,             -- as the user left it
    decision TEXT NOT NULL DEFAULT '',  -- '' | 'approved' | 'discarded'
    PRIMARY KEY (task_id, pass, number),
    FOREIGN KEY (task_id, pass) REFERENCES pr_passes (task_id, pass) ON DELETE CASCADE
) STRICT;
