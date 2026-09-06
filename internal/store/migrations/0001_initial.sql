CREATE TABLE recent_workspaces (
    path           TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    last_opened_at TEXT NOT NULL
) STRICT;

CREATE INDEX recent_workspaces_last_opened_at
    ON recent_workspaces (last_opened_at DESC);

CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
) STRICT;
