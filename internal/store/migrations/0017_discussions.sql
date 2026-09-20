-- The discussions: the item that understands a demand of a board and
-- produces cards. A discussion keeps its board when the board goes, so
-- board_id has no foreign key. Every draft the agent wrote or the user
-- created, with what the user edited and decided and what was published on
-- GitHub, is stored here: the artifact on disk is the agent's and the app
-- never rewrites it. A board gets the status its new cards are created with.
ALTER TABLE boards ADD COLUMN new_card_status TEXT NOT NULL DEFAULT ''; -- the option id of the Status field a new card gets; '' for none

CREATE TABLE discussions (
    id              TEXT PRIMARY KEY,
    board_id        TEXT NOT NULL,                -- no foreign key: the discussion outlives the board
    board_title     TEXT NOT NULL,                -- as it was when the discussion was created
    title           TEXT NOT NULL,
    text            TEXT NOT NULL DEFAULT '',     -- what the user wrote when creating it; '' for none
    initial_context TEXT NOT NULL,
    artifacts_dir   TEXT NOT NULL,
    drafts_read     INTEGER NOT NULL DEFAULT 0,   -- 1 once a readable drafts artifact was recorded
    drafts_revision INTEGER NOT NULL DEFAULT 0,   -- bumped every time the artifact is read again and differs
    archived_at     TEXT,                         -- NULL while active
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
) STRICT;

CREATE INDEX discussions_archived_created ON discussions (archived_at, created_at);

CREATE TRIGGER discussions_item_insert AFTER INSERT ON discussions
BEGIN INSERT INTO items (id, kind) VALUES (NEW.id, 'discussion'); END;

CREATE TRIGGER discussions_item_delete AFTER DELETE ON discussions
BEGIN DELETE FROM items WHERE id = OLD.id; END;

CREATE TABLE discussion_cards (
    discussion_id TEXT NOT NULL REFERENCES discussions (id) ON DELETE CASCADE,
    position      INTEGER NOT NULL,
    owner         TEXT NOT NULL,
    name          TEXT NOT NULL,
    number        INTEGER NOT NULL,
    title         TEXT NOT NULL,
    url           TEXT NOT NULL,
    PRIMARY KEY (discussion_id, position)
) STRICT;

CREATE TABLE discussion_drafts (
    discussion_id       TEXT NOT NULL REFERENCES discussions (id) ON DELETE CASCADE,
    draft_id            TEXT NOT NULL,              -- the id the artifact names it by, or user-epic-<n>
    position            INTEGER NOT NULL,
    kind                TEXT NOT NULL,              -- discussion.Kind: 'new' | 'update' | 'epic'
    source              TEXT NOT NULL,              -- discussion.Source: 'agent' | 'user'
    owner               TEXT NOT NULL,              -- the repository of the issue, as the draft has it now
    name                TEXT NOT NULL,
    repository_original TEXT NOT NULL,              -- owner/name as the artifact has it; '' for a user epic
    card_number         INTEGER NOT NULL DEFAULT 0, -- update: the issue it updates; 0 otherwise
    card_title          TEXT NOT NULL DEFAULT '',
    card_url            TEXT NOT NULL DEFAULT '',
    title_original      TEXT NOT NULL DEFAULT '',   -- as the artifact has it
    title               TEXT NOT NULL DEFAULT '',   -- as the user left it
    body_original       TEXT NOT NULL DEFAULT '',
    body                TEXT NOT NULL DEFAULT '',
    module_original     TEXT NOT NULL DEFAULT '',   -- the name of the option; '' for none
    module              TEXT NOT NULL DEFAULT '',
    epic_original       TEXT NOT NULL DEFAULT '',   -- a draft id or owner/name#number; '' for none
    epic                TEXT NOT NULL DEFAULT '',
    decision            TEXT NOT NULL DEFAULT '',   -- discussion.Decision: '' | 'approved' | 'discarded'
    revision            INTEGER NOT NULL DEFAULT 1, -- bumped every time the artifact changes this draft
    warnings            TEXT NOT NULL DEFAULT '[]', -- JSON []string, what the publication or a rewrite said
    publish_error       TEXT NOT NULL DEFAULT '',   -- why the last publication failed; '' otherwise
    outcome             TEXT NOT NULL DEFAULT '',   -- discussion.Outcome: '' | 'created' | 'updated'
    issue_number        INTEGER NOT NULL DEFAULT 0, -- the issue on GitHub once created or updated
    issue_url           TEXT NOT NULL DEFAULT '',
    issue_node_id       TEXT NOT NULL DEFAULT '',
    item_id             TEXT NOT NULL DEFAULT '',   -- the item of the issue on the board
    status_set          INTEGER NOT NULL DEFAULT 0,
    module_set          INTEGER NOT NULL DEFAULT 0,
    parent_set          INTEGER NOT NULL DEFAULT 0,
    published_at        TEXT,                       -- NULL until every step of the publication is done
    PRIMARY KEY (discussion_id, draft_id)
) STRICT;

CREATE INDEX discussion_drafts_issue ON discussion_drafts (owner COLLATE NOCASE, name COLLATE NOCASE, issue_number);

CREATE TABLE discussion_dependencies (
    discussion_id TEXT NOT NULL,
    draft_id      TEXT NOT NULL,
    position      INTEGER NOT NULL,
    ref           TEXT NOT NULL,                  -- a draft id, or owner/name#number
    original      INTEGER NOT NULL DEFAULT 1,     -- 1 when the artifact names it; 0 when the user added it
    linked        INTEGER NOT NULL DEFAULT 0,     -- 1 once GitHub has the blocked-by relation
    dropped       TEXT NOT NULL DEFAULT '',       -- discussion.Drop: '' | 'discarded' | 'unavailable'
    detail        TEXT NOT NULL DEFAULT '',       -- unavailable: what gh said
    PRIMARY KEY (discussion_id, draft_id, position),
    FOREIGN KEY (discussion_id, draft_id) REFERENCES discussion_drafts (discussion_id, draft_id) ON DELETE CASCADE
) STRICT;
