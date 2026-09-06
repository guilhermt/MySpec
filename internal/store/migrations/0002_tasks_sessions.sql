CREATE TABLE tasks (
    id               TEXT PRIMARY KEY,
    workspace_path   TEXT NOT NULL,
    name             TEXT NOT NULL,
    repo_path        TEXT,                 -- NULL for a task created at the workspace root
    initial_context  TEXT NOT NULL,
    stage            TEXT NOT NULL,        -- 'prd' | 'prd_done'
    artifacts_dir    TEXT NOT NULL,
    artifact_version INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX tasks_workspace_name ON tasks (workspace_path, name);
CREATE INDEX tasks_workspace_created ON tasks (workspace_path, created_at);

CREATE TABLE sessions (
    id             TEXT PRIMARY KEY,       -- also the Claude Code session id
    task_id        TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    stage          TEXT NOT NULL,          -- 'prd'
    started        INTEGER NOT NULL DEFAULT 0,  -- 1 once system/init arrived for this id
    paused         INTEGER NOT NULL DEFAULT 0,
    context_tokens INTEGER NOT NULL DEFAULT 0,
    context_window INTEGER NOT NULL DEFAULT 0,
    last_error     TEXT,                   -- NULL when the session is healthy
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
) STRICT;

CREATE INDEX sessions_task ON sessions (task_id);

CREATE TABLE transcript_entries (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    seq        INTEGER NOT NULL,
    turn_id    TEXT NOT NULL,
    kind       TEXT NOT NULL,              -- user | assistant | action | permission | question | marker | error
    payload    TEXT NOT NULL,              -- JSON, one object per kind (see internal/session)
    created_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX transcript_entries_session_seq ON transcript_entries (session_id, seq);
