-- Stages after the PRD, the revisit of a finished stage and one session per
-- stage of a task.
ALTER TABLE tasks ADD COLUMN revisiting INTEGER NOT NULL DEFAULT 0;
UPDATE tasks SET stage = 'prd' WHERE stage = 'prd_done';

ALTER TABLE sessions ADD COLUMN corrections INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX sessions_task_stage ON sessions (task_id, stage);
