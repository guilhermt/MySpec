# Commit

The work of this session was reviewed and approved. Commit it.

## What to commit

{{what_to_commit}}

Make **one commit**. Do not amend, rebase, tag or create branches.

If the worktree has a merge in progress (`git rev-parse -q --verify MERGE_HEAD` succeeds), the commit concludes that merge: run `git commit --no-edit`, which keeps the message git prepared for it, and write no message of your own. Everything else here still holds: what to commit, one commit, and the push.

## The message

Read the recent history first, with `git log --oneline -20`, and follow the conventions of the repository: language, capitalisation, and prefixes if it uses them.

Unless the repository says otherwise:

- One subject line, in the imperative mood, saying what the change does — "Add the review strip to the step bar", not "Added" or "Adding".
- No prefix, no tag, no emoji, no full stop at the end.
- A body only when it says something the subject cannot, in one or two sentences, separated from the subject by a blank line.

Never mention the planning behind the change: no task name, no step number, no reference to a PRD, a tech spec or a step file. The message describes the change, not the process that produced it.

Never add authorship trailers. No `Co-Authored-By`, no mention of Claude Code or of any agent.

## Pushing

{{push}}

## When you are done

Say the short sha and the subject of the commit, in one line, and nothing else.
