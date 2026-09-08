-- Where a step started and what it produced. Both are commits of the branch
-- of the worktree; the status of the step is derived from them.
ALTER TABLE steps ADD COLUMN start_commit   TEXT NOT NULL DEFAULT '';
ALTER TABLE steps ADD COLUMN commit_sha     TEXT NOT NULL DEFAULT '';
ALTER TABLE steps ADD COLUMN commit_subject TEXT NOT NULL DEFAULT '';
