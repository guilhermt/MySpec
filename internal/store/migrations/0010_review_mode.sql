-- The review mode: who reviews the steps of a task, as the JSON of
-- task.ReviewModes, and how far the agent review of each step got. The tasks
-- that exist are reviewed by the user, and take the factory choice of the step
-- review.
ALTER TABLE tasks ADD COLUMN review_modes TEXT NOT NULL DEFAULT '{"task":"manual"}'; -- JSON of task.ReviewModes
UPDATE tasks SET models = json_set(models, '$.stages.step_review', json('{"model":"claude-opus-5","effort":"high"}'));

ALTER TABLE steps ADD COLUMN review_pass     INTEGER NOT NULL DEFAULT 0; -- the last pass of the agent review the app asked for
ALTER TABLE steps ADD COLUMN reported_pass   INTEGER NOT NULL DEFAULT 0; -- the last pass whose report the app acted on
ALTER TABLE steps ADD COLUMN review_fallback TEXT NOT NULL DEFAULT '';   -- task.ReviewFallback; '' while the mode of the step holds
