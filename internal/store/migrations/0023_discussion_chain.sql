-- An epic of a discussion goes to GitHub on its own once the drafts it needs
-- are decided. An epic approved before that, and never started, waited for a
-- gesture that no longer exists: it goes back to be decided, without the
-- failure the run before the rule may have left on it, so that nothing is
-- written on GitHub without a gesture made under the rule.
UPDATE discussion_drafts SET decision = '', publish_error = ''
WHERE kind = 'epic' AND decision = 'approved' AND outcome = ''
  AND discussion_id IN (SELECT id FROM discussions WHERE archived_at IS NULL);
