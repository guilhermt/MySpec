-- What went wrong with a pull request after its review. trouble_baseline is
-- what the reading the last review pass started from showed wrong, and
-- trouble is what went wrong since: the checks that failed and a conflict
-- with the base, as JSON gh.Trouble; '' for nothing.
ALTER TABLE pr_runs ADD COLUMN trouble_baseline TEXT NOT NULL DEFAULT '';
ALTER TABLE pr_runs ADD COLUMN trouble TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN trouble_baseline TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN trouble TEXT NOT NULL DEFAULT '';
