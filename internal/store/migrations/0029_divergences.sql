-- The divergence of an item: what the app expected after its one instruction,
-- and found otherwise. An item has one at most, and it lasts until the state
-- of the item matches again.
CREATE TABLE divergences (
    item_id    TEXT PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
    stage      TEXT NOT NULL,  -- the conversation it belongs to, as session.Key.Stage
    kind       TEXT NOT NULL,  -- divergence.Kind
    facts      TEXT NOT NULL,  -- divergence.Facts as JSON
    started_at TEXT NOT NULL
) STRICT;

-- The head branch of the pull request of a task, as GitHub names it; '' until
-- read. It differs from the branch of the task when the user adopted a pull
-- request of another branch.
ALTER TABLE pr_runs ADD COLUMN pr_head TEXT NOT NULL DEFAULT '';

-- Whether the worktree had changes after the approved findings of a pass went
-- to the implementer, or the user adopted the pass as applied: a pass that
-- ends with nothing to commit is then resolved, not a divergence.
ALTER TABLE pr_passes ADD COLUMN changed INTEGER NOT NULL DEFAULT 0;

-- Whether the app already asked the agent of a discussion to fix an
-- unreadable drafts.md; cleared by the next readable reading.
ALTER TABLE discussions ADD COLUMN drafts_corrected INTEGER NOT NULL DEFAULT 0;
