-- The item, what has a conversation, a worktree and situations. A task is one
-- item; the review of a pull request is another. items is the parent every one
-- of them has a row in, so that sessions, worktrees and situations belong to an
-- item and go with it by cascade. Triggers keep the row of a task and the row
-- of a review in step with their tables, so nothing else has to. The reviews
-- come with their passes, the findings of each pass and what the user decided
-- about each finding, and a repository gets the instructions that go into every
-- review of its pull requests.
CREATE TABLE items (
    id   TEXT PRIMARY KEY,
    kind TEXT NOT NULL   -- 'task' | 'review'
) STRICT;

INSERT INTO items (id, kind) SELECT id, 'task' FROM tasks;

CREATE TRIGGER tasks_item_insert AFTER INSERT ON tasks
BEGIN INSERT INTO items (id, kind) VALUES (NEW.id, 'task'); END;

CREATE TRIGGER tasks_item_delete AFTER DELETE ON tasks
BEGIN DELETE FROM items WHERE id = OLD.id; END;

-- sessions and its transcript entries move to the item. The child is recreated
-- with the parent and dropped first, because dropping sessions with foreign
-- keys on would take the entries by cascade.
CREATE TABLE sessions_of_item (
    id             TEXT PRIMARY KEY,       -- also the Claude Code session id
    item_id        TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
    stage          TEXT NOT NULL,          -- the stage of a task, or 'review'
    started        INTEGER NOT NULL DEFAULT 0,  -- 1 once system/init arrived for this id
    paused         INTEGER NOT NULL DEFAULT 0,
    context_tokens INTEGER NOT NULL DEFAULT 0,
    context_window INTEGER NOT NULL DEFAULT 0,
    corrections    INTEGER NOT NULL DEFAULT 0,
    last_error     TEXT,                   -- NULL when the session is healthy
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    model          TEXT NOT NULL DEFAULT '',
    effort         TEXT NOT NULL DEFAULT ''
) STRICT;

INSERT INTO sessions_of_item (id, item_id, stage, started, paused, context_tokens, context_window,
        corrections, last_error, created_at, updated_at, model, effort)
    SELECT id, task_id, stage, started, paused, context_tokens, context_window,
        corrections, last_error, created_at, updated_at, model, effort
    FROM sessions;

CREATE TABLE transcript_entries_of_item (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions_of_item (id) ON DELETE CASCADE,
    seq        INTEGER NOT NULL,
    turn_id    TEXT NOT NULL,
    kind       TEXT NOT NULL,              -- user | assistant | action | permission | question | marker | error
    payload    TEXT NOT NULL,              -- JSON, one object per kind (see internal/session)
    created_at TEXT NOT NULL
) STRICT;

INSERT INTO transcript_entries_of_item (id, session_id, seq, turn_id, kind, payload, created_at)
    SELECT id, session_id, seq, turn_id, kind, payload, created_at FROM transcript_entries;

DROP TABLE transcript_entries;
DROP TABLE sessions;
ALTER TABLE sessions_of_item RENAME TO sessions;
ALTER TABLE transcript_entries_of_item RENAME TO transcript_entries;

CREATE INDEX sessions_item ON sessions (item_id);
CREATE UNIQUE INDEX sessions_item_stage ON sessions (item_id, stage);
CREATE UNIQUE INDEX transcript_entries_session_seq ON transcript_entries (session_id, seq);

CREATE TABLE worktrees_of_item (
    item_id    TEXT PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
    repo_path  TEXT NOT NULL,   -- the clone git runs in for this worktree
    path       TEXT NOT NULL,
    branch     TEXT NOT NULL,   -- '' for a worktree on a detached HEAD
    base       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
) STRICT;

INSERT INTO worktrees_of_item (item_id, repo_path, path, branch, base, created_at)
    SELECT task_id, repo_path, path, branch, base, created_at FROM worktrees;

DROP TABLE worktrees;
ALTER TABLE worktrees_of_item RENAME TO worktrees;

CREATE TABLE situations_of_item (
    item_id    TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
    place      TEXT NOT NULL,   -- 'stage:<stage>' | 'step:<number>' | 'step_review:<number>' | 'pr' | 'review'
    id         TEXT NOT NULL,   -- the id the interface and the notification know the situation by
    kind       TEXT NOT NULL,   -- attention.Kind
    started_at TEXT NOT NULL,
    PRIMARY KEY (item_id, place)
) STRICT;

INSERT INTO situations_of_item (item_id, place, id, kind, started_at)
    SELECT task_id, place, id, kind, started_at FROM situations;

DROP TABLE situations;
ALTER TABLE situations_of_item RENAME TO situations;

ALTER TABLE repositories ADD COLUMN review_instructions TEXT NOT NULL DEFAULT '';

CREATE TABLE reviews (
    id               TEXT PRIMARY KEY,
    repository_id    TEXT NOT NULL REFERENCES repositories (id),
    number           INTEGER NOT NULL,
    title            TEXT NOT NULL,
    author           TEXT NOT NULL,
    url              TEXT NOT NULL,
    head_branch      TEXT NOT NULL,
    base_branch      TEXT NOT NULL,              -- as GitHub names it, without origin/
    own              INTEGER NOT NULL DEFAULT 0, -- 1 when the author is the gh account
    mode             TEXT NOT NULL,              -- prreview.Mode: 'publish' | 'apply'
    phase            TEXT NOT NULL DEFAULT '',   -- prreview.Phase: '' | 'applying' | 'committing'; apply only
    card             TEXT NOT NULL DEFAULT '',   -- JSON prreview.Card; '' without a card
    artifacts_dir    TEXT NOT NULL,
    asked_pass       INTEGER NOT NULL DEFAULT 0, -- the last pass the app asked for
    reported_pass    INTEGER NOT NULL DEFAULT 0, -- the last pass whose report the app recorded
    pass_commit      TEXT NOT NULL DEFAULT '',   -- the commit the last recorded report covered
    published_pass   INTEGER NOT NULL DEFAULT 0,
    published_commit TEXT NOT NULL DEFAULT '',   -- the head the last published review was sent against
    head_commit      TEXT NOT NULL DEFAULT '',   -- the head GitHub last reported
    pr_state         TEXT NOT NULL DEFAULT 'open', -- 'open' | 'merged' | 'closed'
    pr_checked_at    TEXT,
    publish_error    TEXT NOT NULL DEFAULT '',   -- why the last publication failed; '' otherwise
    archived_at      TEXT,                       -- NULL while active
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX reviews_active_pr ON reviews (repository_id, number) WHERE archived_at IS NULL;
CREATE INDEX reviews_archived_created ON reviews (archived_at, created_at);

CREATE TRIGGER reviews_item_insert AFTER INSERT ON reviews
BEGIN INSERT INTO items (id, kind) VALUES (NEW.id, 'review'); END;

CREATE TRIGGER reviews_item_delete AFTER DELETE ON reviews
BEGIN DELETE FROM items WHERE id = OLD.id; END;

CREATE TABLE review_passes (
    review_id        TEXT NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    pass             INTEGER NOT NULL,
    instructions     TEXT NOT NULL DEFAULT '',   -- what the user wrote when asking for the pass
    recorded         INTEGER NOT NULL DEFAULT 0, -- 1 once a readable report was recorded
    clean            INTEGER NOT NULL DEFAULT 0,
    commit_sha       TEXT NOT NULL DEFAULT '',   -- the head of the worktree when the report was recorded
    summary_original TEXT NOT NULL DEFAULT '',   -- as the report has it
    summary          TEXT NOT NULL DEFAULT '',   -- as the user left it
    revision         INTEGER NOT NULL DEFAULT 0, -- bumped every time the report is read again and differs
    verdict          TEXT NOT NULL DEFAULT '',   -- 'approve' | 'request_changes' | 'comment'; '' until published
    published_at     TEXT,
    published_url    TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL,
    PRIMARY KEY (review_id, pass)
) STRICT;

CREATE TABLE review_findings (
    review_id TEXT NOT NULL,
    pass      INTEGER NOT NULL,
    number    INTEGER NOT NULL,             -- as the report numbers it
    path      TEXT NOT NULL DEFAULT '',     -- '' for a general finding
    line      INTEGER NOT NULL DEFAULT 0,   -- 0 for a general finding
    original  TEXT NOT NULL,                -- as the report has it
    text      TEXT NOT NULL,                -- as the user left it
    decision  TEXT NOT NULL DEFAULT '',     -- '' | 'approved' | 'discarded'
    placement TEXT NOT NULL DEFAULT '',     -- '' | 'inline' | 'body': where a published finding went
    PRIMARY KEY (review_id, pass, number),
    FOREIGN KEY (review_id, pass) REFERENCES review_passes (review_id, pass) ON DELETE CASCADE
) STRICT;
