-- A draft belongs to a round: the drafts of one reading of drafts.md, and the
-- revisions of them until every one of them is on GitHub or discarded. The
-- drafts stored before rounds existed are of the first one.
ALTER TABLE discussion_drafts ADD round INTEGER NOT NULL DEFAULT 1;

-- revised_reading is the drafts_revision of the discussion when a reading last
-- changed the draft within its round; 0 when none ever did.
ALTER TABLE discussion_drafts ADD revised_reading INTEGER NOT NULL DEFAULT 0;

-- approval_cleared is a draft a reading changed while it was approved, which
-- lost the approval and has not been decided again.
ALTER TABLE discussion_drafts ADD approval_cleared INTEGER NOT NULL DEFAULT 0;
