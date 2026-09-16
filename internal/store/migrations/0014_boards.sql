-- The boards of GitHub Projects the user registered, the last reading of each,
-- the board that manages each repository, and the card each task was created
-- from. A repository without a clone has an empty path. The card of a task has
-- no foreign key to its board: the task keeps its card when the board goes.
CREATE TABLE boards (
    id             TEXT PRIMARY KEY,
    owner          TEXT NOT NULL,                -- the login of the organization or the user
    owner_type     TEXT NOT NULL,                -- board.OwnerType: 'organization' | 'user'
    number         INTEGER NOT NULL,
    title          TEXT NOT NULL,                -- as the last reading saw it
    url            TEXT NOT NULL,
    final_statuses TEXT NOT NULL DEFAULT '[]',   -- JSON []string: ids of the Status options the user marked final
    created_at     TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX boards_identity ON boards (owner COLLATE NOCASE, number);

CREATE TABLE board_readings (
    board_id  TEXT PRIMARY KEY REFERENCES boards (id) ON DELETE CASCADE,
    reading   TEXT NOT NULL DEFAULT '',   -- JSON board.Reading of the last reading that succeeded; '' before one
    read_at   TEXT,                       -- NULL before a reading succeeded
    failure   TEXT NOT NULL DEFAULT '',   -- JSON board.Failure of the last reading when it failed; '' otherwise
    failed_at TEXT
) STRICT;

ALTER TABLE repositories ADD COLUMN board_id TEXT REFERENCES boards (id) ON DELETE SET NULL; -- NULL without a board

CREATE TABLE task_cards (
    task_id  TEXT PRIMARY KEY REFERENCES tasks (id) ON DELETE CASCADE,
    board_id TEXT NOT NULL,
    owner    TEXT NOT NULL,
    name     TEXT NOT NULL,
    number   INTEGER NOT NULL,
    title    TEXT NOT NULL,
    body     TEXT NOT NULL DEFAULT '',
    url      TEXT NOT NULL,
    status   TEXT NOT NULL DEFAULT '',
    state    TEXT NOT NULL,               -- task.IssueState: 'open' | 'closed'
    epic     TEXT NOT NULL DEFAULT '',    -- JSON task.CardEpic; '' without an epic
    read_at  TEXT NOT NULL
) STRICT;

CREATE INDEX task_cards_issue ON task_cards (owner COLLATE NOCASE, name COLLATE NOCASE, number);
