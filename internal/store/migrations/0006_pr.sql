-- The PR stage: one row per repository of a task, and the base the branch of
-- a worktree was created from.
ALTER TABLE worktrees ADD COLUMN base TEXT NOT NULL DEFAULT '';

CREATE TABLE pr_runs (
    task_id         TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    repo_path       TEXT NOT NULL,
    status          TEXT NOT NULL,   -- 'preparing' | 'blocked' | 'drafting' | 'opening' | 'reviewing' | 'committing' | 'done' | 'skipped'
    block_reason    TEXT,            -- NULL unless blocked
    block_detail    TEXT,
    pr_number       INTEGER NOT NULL DEFAULT 0,
    pr_url          TEXT NOT NULL DEFAULT '',
    pr_state        TEXT NOT NULL DEFAULT '',   -- 'open' | 'merged' | 'closed'
    pr_checked_at   TEXT,
    reviewed_commit TEXT NOT NULL DEFAULT '',
    reported_pass   INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    PRIMARY KEY (task_id, repo_path)
) STRICT;
