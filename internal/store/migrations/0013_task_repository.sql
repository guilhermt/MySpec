-- A task belongs to a repository, not to a workspace: the columns of the
-- workspace go, the PR stage and the worktree are the task's own, the sessions
-- and the situations of the PR stage lose the slug of a repository, a step is
-- no longer blocked for naming a repository, and the recent workspaces go.
DROP INDEX tasks_workspace_name;
DROP INDEX tasks_workspace_created;
DROP INDEX tasks_workspace_archived;
ALTER TABLE tasks DROP COLUMN workspace_path;
ALTER TABLE tasks DROP COLUMN repo_path;
CREATE UNIQUE INDEX tasks_repository_name ON tasks (repository_id, name);
CREATE INDEX tasks_archived_created ON tasks (archived_at, created_at);

CREATE TABLE pr_runs_of_task (
    task_id         TEXT PRIMARY KEY REFERENCES tasks (id) ON DELETE CASCADE,
    status          TEXT NOT NULL,   -- task.PRStatus
    block_reason    TEXT,            -- NULL unless blocked
    block_detail    TEXT,
    pr_number       INTEGER NOT NULL DEFAULT 0,
    pr_url          TEXT NOT NULL DEFAULT '',
    pr_state        TEXT NOT NULL DEFAULT '',   -- 'open' | 'merged' | 'closed'
    pr_checked_at   TEXT,
    pr_base         TEXT NOT NULL DEFAULT '',
    reviewed_commit TEXT NOT NULL DEFAULT '',
    reported_pass   INTEGER NOT NULL DEFAULT 0,
    close_result    TEXT NOT NULL DEFAULT '',   -- JSON of task.CloseResult; '' until closed
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
) STRICT;

INSERT INTO pr_runs_of_task (task_id, status, block_reason, block_detail, pr_number, pr_url, pr_state,
        pr_checked_at, pr_base, reviewed_commit, reported_pass, close_result, created_at, updated_at)
    SELECT task_id, CASE status WHEN 'skipped' THEN 'closed' ELSE status END, block_reason, block_detail,
        pr_number, pr_url, pr_state, pr_checked_at, pr_base, reviewed_commit, reported_pass, close_result,
        created_at, updated_at
    FROM pr_runs;

DROP TABLE pr_runs;
ALTER TABLE pr_runs_of_task RENAME TO pr_runs;

CREATE TABLE worktrees_of_task (
    task_id    TEXT PRIMARY KEY REFERENCES tasks (id) ON DELETE CASCADE,
    repo_path  TEXT NOT NULL,   -- the clone git runs in for this worktree
    path       TEXT NOT NULL,
    branch     TEXT NOT NULL,
    base       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
) STRICT;

INSERT INTO worktrees_of_task (task_id, repo_path, path, branch, base, created_at)
    SELECT task_id, repo_path, path, branch, base, created_at FROM worktrees;

DROP TABLE worktrees;
ALTER TABLE worktrees_of_task RENAME TO worktrees;

UPDATE sessions SET stage = 'pr' WHERE stage GLOB 'pr:*';
UPDATE sessions SET stage = 'pr_review' WHERE stage GLOB 'pr_review:*';
UPDATE situations SET place = 'pr' WHERE place GLOB 'repo:*';
UPDATE steps SET block_reason = 'git_failed' WHERE block_reason = 'no_repository';

DROP TABLE recent_workspaces;
