-- Closing and archiving: when a task left the workspace, the base branch of
-- the pull request of each repository, and what closing the repository did.
-- The status column of pr_runs also holds 'closing' and 'closed' from this
-- version on.
ALTER TABLE tasks ADD COLUMN archived_at TEXT; -- NULL while the task is in the workspace

CREATE INDEX tasks_workspace_archived ON tasks (workspace_path, archived_at);

ALTER TABLE pr_runs ADD COLUMN pr_base      TEXT NOT NULL DEFAULT ''; -- baseRefName as gh reports it
ALTER TABLE pr_runs ADD COLUMN close_result TEXT NOT NULL DEFAULT ''; -- JSON of task.CloseResult; '' until closed
