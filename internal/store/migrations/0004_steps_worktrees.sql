-- The steps the app started and the worktrees it created. The stage column of
-- sessions also holds "step:<number>" from this version on.
CREATE TABLE steps (
    task_id      TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    number       INTEGER NOT NULL,
    status       TEXT NOT NULL,             -- 'preparing' | 'blocked' | 'started'
    block_reason TEXT,                      -- NULL unless blocked
    block_detail TEXT,
    block_files  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    PRIMARY KEY (task_id, number)
) STRICT;

CREATE TABLE worktrees (
    task_id    TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    repo_path  TEXT NOT NULL,
    path       TEXT NOT NULL,
    branch     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (task_id, repo_path)
) STRICT;
