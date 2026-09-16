-- The repositories the user registered, each a clone of a GitHub repository,
-- and the repository every task belongs to. A database that still holds tasks
-- of a workspace gets repository_id filled in the transaction of this
-- migration by the upgrade the app passes to store.Open, which reads the
-- origin of every clone; 0013 drops the columns of the workspace.
CREATE TABLE repositories (
    id         TEXT PRIMARY KEY,
    owner      TEXT NOT NULL,   -- as the origin remote writes it
    name       TEXT NOT NULL,
    path       TEXT NOT NULL,   -- the root of the clone, absolute
    created_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX repositories_identity ON repositories (owner COLLATE NOCASE, name COLLATE NOCASE);

ALTER TABLE tasks ADD COLUMN repository_id TEXT REFERENCES repositories (id); -- never NULL once this migration is applied
