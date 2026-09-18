-- Whether the fixes of the approved findings of a pass went up in a commit the
-- app asked for, in apply mode. It is recorded when the commit is seen, because
-- the head of the pull request also moves with commits the app never made.
ALTER TABLE review_passes ADD COLUMN applied INTEGER NOT NULL DEFAULT 0; -- 1 once the fixes of its approved findings went up in a commit of the app (apply mode)
