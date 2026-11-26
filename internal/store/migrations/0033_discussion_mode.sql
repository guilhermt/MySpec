-- How the agent conducts the discussion: refine, which asks until the demand is
-- clear, or register, which writes the card from what the user wrote.
ALTER TABLE discussions ADD COLUMN mode TEXT NOT NULL DEFAULT 'refine' CHECK (mode IN ('refine', 'register'));
