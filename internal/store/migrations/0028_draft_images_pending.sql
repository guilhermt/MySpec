-- Whether GitHub has the issue of a draft with some image of its body still to
-- attach: an issue create or edit with --attach that stopped halfway.
ALTER TABLE discussion_drafts ADD COLUMN images_pending INTEGER NOT NULL DEFAULT 0;
