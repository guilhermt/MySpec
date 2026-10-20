-- The review of the pull request of a task runs with a reviewer and an
-- implementer. review_fallback is why a pull request whose review started in
-- agent mode is reviewed by the user: taken_over, rounds_exhausted or
-- commit_failed, as task.ReviewFallback; '' while its mode holds. The mode
-- itself lives in tasks.review_modes, whose missing "pr" reads as manual, so
-- the tasks that exist keep the review they had. The implementer of every
-- task starts with the choice its review had, which is the session that
-- applied the findings until now. A task whose models are not JSON, which has
-- no choice to carry over, is left as it is.
ALTER TABLE pr_runs ADD COLUMN review_fallback TEXT NOT NULL DEFAULT '';
UPDATE tasks SET models = json_set(models, '$.stages.pr_fix', json(json_extract(models, '$.stages.pr_review')))
WHERE CASE WHEN json_valid(models) THEN json_extract(models, '$.stages.pr_review') IS NOT NULL ELSE 0 END;
