-- The model and the effort the sessions run with: the choice of every stage of
-- a task and of the steps that have one of their own, as the JSON of
-- task.Models, and the one each session holds. The tasks that exist take the
-- factory defaults.
ALTER TABLE tasks ADD COLUMN models TEXT NOT NULL DEFAULT ''; -- JSON of task.Models
UPDATE tasks SET models = '{"stages":{"prd":{"model":"claude-fable-5-1","effort":"high"},"tech_spec":{"model":"claude-fable-5-1","effort":"high"},"plan":{"model":"claude-fable-5-1","effort":"high"},"implementation":{"model":"claude-opus-5","effort":"high"},"pr":{"model":"claude-opus-5","effort":"medium"},"pr_review":{"model":"claude-opus-5","effort":"high"}}}';

ALTER TABLE sessions ADD COLUMN model  TEXT NOT NULL DEFAULT ''; -- '' only for a session a version before this one created
ALTER TABLE sessions ADD COLUMN effort TEXT NOT NULL DEFAULT '';
