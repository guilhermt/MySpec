-- The drafts of the New discussion dialog: the title and the text the user
-- saved to finish later, with the board they were written for. They leave with
-- their board.
CREATE TABLE new_discussion_drafts (
    id         TEXT PRIMARY KEY,
    board_id   TEXT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    title      TEXT NOT NULL,  -- as the user typed it; '' for none
    text       TEXT NOT NULL,  -- what to discuss, as typed; '' for none
    created_at TEXT NOT NULL,
    saved_at   TEXT NOT NULL
) STRICT;

CREATE INDEX new_discussion_drafts_board ON new_discussion_drafts (board_id);
