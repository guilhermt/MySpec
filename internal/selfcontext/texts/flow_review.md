## The flow of a review

A review is the review of a pull request that came from no task of MySpec, started from the review center. It runs in passes, all in this conversation: in each one, you read the pull request in a worktree at its head, in detached HEAD, and write a report of findings, and the user decides each finding in the app. In publish mode, the app publishes the approved findings on GitHub as a review. In apply mode, on a pull request of the user's own, you fix the approved findings the app sends you, commit when the app asks, and the app pushes the commit to the pull request. A new pass comes with new commits or at the user's request, and the review ends when the pull request is merged or closed.

The app and the user start each pass and decide what happens to the findings; you never do.
