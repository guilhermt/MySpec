-- The images of the initial context of a task and of a discussion: the ones
-- read from the cards and the ones the user attached at creation, as a JSON
-- array of images.Image, in the order they reach the agent. Their files live
-- in images/ inside the artifacts folder of the item.
ALTER TABLE tasks ADD COLUMN initial_images TEXT NOT NULL DEFAULT '[]';
ALTER TABLE discussions ADD COLUMN initial_images TEXT NOT NULL DEFAULT '[]';
