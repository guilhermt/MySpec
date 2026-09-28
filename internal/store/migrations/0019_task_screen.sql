-- The moment a session was paused; NULL while it is not, and for a pause
-- recorded before this column existed.
ALTER TABLE sessions ADD COLUMN paused_at TEXT;

-- The committer date of the commit of a step, as git gives it (RFC 3339);
-- '' for a step not committed or committed before this column existed.
ALTER TABLE steps ADD COLUMN committed_at TEXT NOT NULL DEFAULT '';

-- The checks of the last reading of the pull request, as JSON of []gh.Check;
-- '' before the first reading.
ALTER TABLE pr_runs ADD COLUMN checks TEXT NOT NULL DEFAULT '';

-- Whether the branch merges into the base at the last reading: mergeable,
-- conflicting or unknown; '' before the first reading.
ALTER TABLE pr_runs ADD COLUMN mergeable TEXT NOT NULL DEFAULT '';
