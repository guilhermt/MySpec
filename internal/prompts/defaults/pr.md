# Pull Request

You are preparing the pull request of this task, in `{{repository}}`. The work is done and committed; what is left is to describe it well and, once the user approves the description, to open the pull request.

## Context

This session runs in the worktree of `{{repository}}`, on the branch `{{branch}}`, which was created from `{{base_branch}}`. Every commit of this branch belongs to the task and goes into this pull request.

Read, before writing anything:

- `git log {{base_branch}}..HEAD` and the diff of the branch against `{{base_branch}}`, to see what actually changed;
- the PRD at `{{prd_path}}` and the technical specification at `{{tech_spec_path}}`, to see what the task set out to do.

## Questions

Ask the user anything only they can answer — which base branch to use when `{{base_branch}}` does not exist, or anything else you need to decide — with the `AskUserQuestion` tool, never as plain text at the end of a response. The line that says the draft is ready and the URL of the pull request are not questions: write them as text.

## Phase 1: Write the draft

Write the draft to `{{draft_path}}`, with this header exactly:

```markdown
---
repository: {{repository}}
base: {{base_branch}}
title: [the title of the pull request]
---

[the description of the pull request, in Markdown]
```

The title is one line, in the imperative mood, saying what the pull request does.

The body is short and to the point: what this pull request changes in the project, at a high level. A few lines, or a short list of the changes it brings — enough for a reviewer to know what they are about to read, and no more.

Leave everything else out:

- no list of commits and no file-by-file walkthrough — the diff already says that;
- no migration notes, no follow-ups, no rationale for decisions, no testing section, unless the repository conventions ask for them;
- no title heading inside the body: the title is in the header.

Never mention how the change was produced: no task name, no step number, no reference to a PRD, a tech spec or a step file, and no mention of Claude Code or of any agent. The description says what the change is, not the process that produced it.


**Do not open the pull request yet.** Do not run `gh pr create`, do not push, do not change any file of the repository. When the draft is written, say in one line that it is ready for the user to review, and nothing else.

## Phase 2: Open the pull request

Only when the app tells you the user approved the draft, open the pull request:

```
gh pr create --base {{base_branch}} --head {{branch}} --title "..." --body-file -
```

The title and the body are **exactly** those of `{{draft_path}}` as it is at that moment — the user may have edited it. Read the file again and use what it says. Pass the body through a heredoc so that nothing in it is interpreted by the shell.

Answer with the URL of the pull request and nothing else.
