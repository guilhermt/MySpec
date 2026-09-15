-- The mode of a task: how it is conducted, structured or one_shot, as
-- task.Mode. It is chosen when the task is created and never changes; the
-- tasks that exist are structured.
ALTER TABLE tasks ADD COLUMN mode TEXT NOT NULL DEFAULT 'structured'; -- task.Mode
