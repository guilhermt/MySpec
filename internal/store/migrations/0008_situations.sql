-- The situations a task waits on the user for, with the instant each one
-- started, so that a wait survives the app closing. A place of a task holds
-- one situation at most.
CREATE TABLE situations (
    task_id    TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    place      TEXT NOT NULL,   -- 'stage:<stage>' | 'step:<number>' | 'repo:<absolute path>'
    id         TEXT NOT NULL,   -- the id the interface and the notification know the situation by
    kind       TEXT NOT NULL,   -- attention.Kind
    started_at TEXT NOT NULL,
    PRIMARY KEY (task_id, place)
) STRICT;
