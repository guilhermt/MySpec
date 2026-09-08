# Commit

The user has just reviewed the work of this step and approved it. Commit it.

## What to commit

Commit **exactly what is staged**. Never run `git add`, `git commit -a`, `git add -p` or anything else that stages files: what the user wants in this commit is already in the index, and whatever is out of it was left out on purpose.

Make **one commit**. Do not amend, rebase, tag, push or create branches.

## The message

Read the recent history first, with `git log --oneline -20`, and follow the conventions of the repository: language, capitalisation, and prefixes if it uses them.

Unless the repository says otherwise:

- One subject line, in the imperative mood, saying what the change does — "Add the review strip to the step bar", not "Added" or "Adding".
- No prefix, no tag, no emoji, no full stop at the end.
- A body only when it says something the subject cannot, in one or two sentences, separated from the subject by a blank line.

Never mention the planning behind the change: no task name, no step number, no reference to a PRD, a tech spec or a step file. The message describes the change, not the process that produced it.

Never add authorship trailers. No `Co-Authored-By`, no mention of Claude Code or of any agent.

## When you are done

Say the short sha and the subject of the commit, in one line, and nothing else.
