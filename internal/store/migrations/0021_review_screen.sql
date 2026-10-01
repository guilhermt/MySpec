-- The title of a finding, as the report writes it on the line of its number;
-- '' for a report without one and for a finding recorded before this column.
ALTER TABLE review_findings ADD COLUMN title TEXT NOT NULL DEFAULT '';

-- The checks of the reading that let the pass start, as JSON of []gh.Check;
-- '' for a pass not sent yet and for one sent before this column.
ALTER TABLE review_passes ADD COLUMN checks TEXT NOT NULL DEFAULT '';

-- Whether the branch merged into the base at that reading: mergeable,
-- conflicting or unknown; '' as checks.
ALTER TABLE review_passes ADD COLUMN mergeable TEXT NOT NULL DEFAULT '';

-- When that reading was made (RFC 3339); '' as checks.
ALTER TABLE review_passes ADD COLUMN checks_read_at TEXT NOT NULL DEFAULT '';

-- When the report of the pass was first recorded (RFC 3339); '' before it is
-- and for a pass recorded before this column.
ALTER TABLE review_passes ADD COLUMN recorded_at TEXT NOT NULL DEFAULT '';

-- When the approved findings of the pass went to the agent, apply mode (RFC
-- 3339); '' before they go and for a pass sent before this column.
ALTER TABLE review_passes ADD COLUMN sent_at TEXT NOT NULL DEFAULT '';

-- Whether the summary went to GitHub with the published review: 1 when it did.
ALTER TABLE review_passes ADD COLUMN summary_published INTEGER NOT NULL DEFAULT 0;

-- A pass published before this column published its summary whenever it had
-- one: PublishedBody trims it, and an empty one went as nothing. SQLite's trim
-- takes only spaces off unless it is told which characters, as strings.TrimSpace
-- does.
UPDATE review_passes
SET summary_published = 1
WHERE published_at IS NOT NULL
  AND trim(summary, ' ' || char(9) || char(10) || char(11) || char(12) || char(13)) <> '';

-- Who merged the pull request and when, and when it was closed, as gh reads
-- them when the review ends: '' otherwise and for a review archived before
-- these columns.
ALTER TABLE reviews ADD COLUMN merged_by TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN merged_at TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN closed_at TEXT NOT NULL DEFAULT '';
